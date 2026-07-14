import { createHash } from "node:crypto";

export const PRIVE_SYNC_EVIDENCE_VERSION =
  "physis-prive-ownership-v1";

export const RECORD_STATUS_PENDING = 0;
export const RECORD_STATUS_ACTIVE = 1;
export const RECORD_STATUS_SUSPENDED = 2;
export const RECORD_STATUS_REVOKED = 3;
export const RECORD_STATUS_EXPIRED = 4;

export const SOURCE_DAO_APPROVED = 1;
export const SOURCE_PRIVE_COLLECTION_VERIFIED = 2;
export const SOURCE_MANUAL_COUNCIL = 4;

export interface PriveEvidenceInput {
  wallet: string;
  assetId: string;
  collection: string;
}

export interface ExistingPriveRecordState {
  status: number;
  source: number;
  metadataHash: readonly number[];
}

export type PriveSyncAction =
  | "skip-ineligible"
  | "create-active"
  | "activate-pending"
  | "refresh-evidence"
  | "no-op"
  | "preserve-authoritative-record"
  | "manual-review";

export interface PriveSyncDecision {
  action: PriveSyncAction;
  shouldMutate: boolean;
  reason: string;
}

export interface PlanPriveSyncInput {
  eligible: boolean;
  existing: ExistingPriveRecordState | null;
  expectedMetadataHash?: readonly number[] | null;
}

function requireCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
	throw new Error(message);
  }
}

function validateHash(
  label: string,
  value: readonly number[],
): void {
  requireCondition(
	value.length === 32,
	`${label} must contain exactly 32 bytes`,
  );

  requireCondition(
	value.every(
	  (byte) =>
		Number.isInteger(byte) &&
		byte >= 0 &&
		byte <= 255,
	),
	`${label} contains an invalid byte`,
  );
}

export function metadataHashesEqual(
  left: readonly number[],
  right: readonly number[],
): boolean {
  validateHash("Left metadata hash", left);
  validateHash("Right metadata hash", right);

  return Buffer.from(left).equals(
	Buffer.from(right),
  );
}

export function buildPriveEvidencePayload(
  input: PriveEvidenceInput,
): string {
  return [
	`version=${PRIVE_SYNC_EVIDENCE_VERSION}`,
	"provider=helius-das",
	`wallet=${input.wallet}`,
	`asset=${input.assetId}`,
	`collection=${input.collection}`,
	"",
  ].join("\n");
}

export function buildPriveEvidenceHash(
  input: PriveEvidenceInput,
): number[] {
  return Array.from(
	createHash("sha256")
	  .update(
		buildPriveEvidencePayload(input),
		"utf8",
	  )
	  .digest(),
  );
}

export function planPriveSync(
  input: PlanPriveSyncInput,
): PriveSyncDecision {
  /*
   * A negative or unavailable ownership result must never
   * revoke, suspend, or otherwise mutate an existing record.
   */
  if (!input.eligible) {
	return {
	  action: "skip-ineligible",
	  shouldMutate: false,
	  reason:
		"No approved PRIVÉ asset is currently verified; no mutation is permitted.",
	};
  }

  const expectedMetadataHash =
	input.expectedMetadataHash;

  requireCondition(
	expectedMetadataHash !== undefined &&
	  expectedMetadataHash !== null,
	"Eligible ownership requires an evidence hash",
  );

  validateHash(
	"Expected metadata hash",
	expectedMetadataHash,
  );

  if (input.existing === null) {
	return {
	  action: "create-active",
	  shouldMutate: true,
	  reason:
		"Verified holder has no existing PRIVE_MEMBER record.",
	};
  }

  validateHash(
	"Existing metadata hash",
	input.existing.metadataHash,
  );

  /*
   * DAO-approved and manually approved records are stronger
   * authority decisions. The collection synchronizer must not
   * overwrite their source or evidence.
   */
  if (
	input.existing.source ===
	  SOURCE_DAO_APPROVED ||
	input.existing.source ===
	  SOURCE_MANUAL_COUNCIL
  ) {
	return {
	  action:
		"preserve-authoritative-record",
	  shouldMutate: false,
	  reason:
		"Existing DAO/manual record is preserved without modification.",
	};
  }

  requireCondition(
	input.existing.source ===
	  SOURCE_PRIVE_COLLECTION_VERIFIED,
	`Existing PRIVE_MEMBER record has an invalid source: ${input.existing.source}`,
  );

  switch (input.existing.status) {
	case RECORD_STATUS_PENDING:
	  return {
		action: "activate-pending",
		shouldMutate: true,
		reason:
		  "Pending collection-verification record may be activated.",
	  };

	case RECORD_STATUS_ACTIVE:
	  if (
		metadataHashesEqual(
		  input.existing.metadataHash,
		  expectedMetadataHash,
		)
	  ) {
		return {
		  action: "no-op",
		  shouldMutate: false,
		  reason:
			"Existing Active record already contains the current evidence.",
		};
	  }

	  return {
		action: "refresh-evidence",
		shouldMutate: true,
		reason:
		  "Existing Active record contains outdated ownership evidence.",
	  };

	case RECORD_STATUS_SUSPENDED:
	  return {
		action: "manual-review",
		shouldMutate: false,
		reason:
		  "Suspended records cannot be automatically reactivated.",
	  };

	case RECORD_STATUS_REVOKED:
	  return {
		action: "manual-review",
		shouldMutate: false,
		reason:
		  "Revoked records cannot be automatically reactivated.",
	  };

	case RECORD_STATUS_EXPIRED:
	  return {
		action: "manual-review",
		shouldMutate: false,
		reason:
		  "Expired records require explicit re-verification policy.",
	  };

	default:
	  throw new Error(
		`Existing PRIVE_MEMBER record has an invalid status: ${input.existing.status}`,
	  );
  }
}
