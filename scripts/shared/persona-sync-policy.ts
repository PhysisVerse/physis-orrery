export const PERSONA_SOURCE_ATTESTATION = 3;

export const PERSONA_RECORD_STATUS_PENDING = 0;
export const PERSONA_RECORD_STATUS_ACTIVE = 1;
export const PERSONA_RECORD_STATUS_SUSPENDED = 2;
export const PERSONA_RECORD_STATUS_REVOKED = 3;
export const PERSONA_RECORD_STATUS_EXPIRED = 4;

export interface ExistingPersonaRecordState {
  status: number;
  source: number;
  metadataHash: readonly number[];
}

export type PersonaSyncAction =
  | "skip-ineligible"
  | "create-active"
  | "activate-pending"
  | "refresh-evidence"
  | "no-op"
  | "manual-review";

export interface PersonaSyncDecision {
  action: PersonaSyncAction;
  shouldMutate: boolean;
  reason: string;
}

export interface PlanPersonaSyncInput {
  eligible: boolean;
  existing:
	| ExistingPersonaRecordState
	| null;
  expectedMetadataHash?:
	| readonly number[]
	| null;
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

export function personaMetadataHashesEqual(
  left: readonly number[],
  right: readonly number[],
): boolean {
  validateHash(
	"Left metadata hash",
	left,
  );

  validateHash(
	"Right metadata hash",
	right,
  );

  return Buffer.from(left).equals(
	Buffer.from(right),
  );
}

export function planPersonaSync(
  input: PlanPersonaSyncInput,
): PersonaSyncDecision {
  if (!input.eligible) {
	return {
	  action: "skip-ineligible",
	  shouldMutate: false,
	  reason:
		"Persona attestation is not currently eligible; no mutation is permitted.",
	};
  }

  const expectedMetadataHash =
	input.expectedMetadataHash;

  requireCondition(
	expectedMetadataHash !== undefined &&
	  expectedMetadataHash !== null,
	"Eligible Persona synchronization requires an evidence hash",
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
		"Verified Persona wallet has no existing PERSONA_VERIFIED record.",
	};
  }

  validateHash(
	"Existing metadata hash",
	input.existing.metadataHash,
  );

  requireCondition(
	input.existing.source ===
	  PERSONA_SOURCE_ATTESTATION,
	[
	  "Existing PERSONA_VERIFIED record has an invalid source.",
	  `Expected: ${PERSONA_SOURCE_ATTESTATION}`,
	  `Actual:   ${input.existing.source}`,
	].join("\n"),
  );

  switch (input.existing.status) {
	case PERSONA_RECORD_STATUS_PENDING:
	  return {
		action: "activate-pending",
		shouldMutate: true,
		reason:
		  "Pending Persona attestation record may be activated.",
	  };

	case PERSONA_RECORD_STATUS_ACTIVE:
	  if (
		personaMetadataHashesEqual(
		  input.existing.metadataHash,
		  expectedMetadataHash,
		)
	  ) {
		return {
		  action: "no-op",
		  shouldMutate: false,
		  reason:
			"Existing Active Persona record already contains the current evidence.",
		};
	  }

	  return {
		action: "refresh-evidence",
		shouldMutate: true,
		reason:
		  "Existing Active Persona record contains outdated attestation evidence.",
	  };

	case PERSONA_RECORD_STATUS_SUSPENDED:
	  return {
		action: "manual-review",
		shouldMutate: false,
		reason:
		  "Suspended Persona records cannot be automatically reactivated.",
	  };

	case PERSONA_RECORD_STATUS_REVOKED:
	  return {
		action: "manual-review",
		shouldMutate: false,
		reason:
		  "Revoked Persona records cannot be automatically reactivated.",
	  };

	case PERSONA_RECORD_STATUS_EXPIRED:
	  return {
		action: "manual-review",
		shouldMutate: false,
		reason:
		  "Expired Persona records require explicit re-verification policy.",
	  };

	default:
	  throw new Error(
		`Existing PERSONA_VERIFIED record has an invalid status: ${input.existing.status}`,
	  );
  }
}
