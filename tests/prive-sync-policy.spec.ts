import { strict as assert } from "node:assert";

import {
  RECORD_STATUS_ACTIVE,
  RECORD_STATUS_EXPIRED,
  RECORD_STATUS_PENDING,
  RECORD_STATUS_REVOKED,
  RECORD_STATUS_SUSPENDED,
  SOURCE_DAO_APPROVED,
  SOURCE_MANUAL_COUNCIL,
  SOURCE_PRIVE_COLLECTION_VERIFIED,
  buildPriveEvidenceHash,
  planPriveSync,
} from "../scripts/shared/prive-sync-policy.ts";

const WALLET =
  "2vLMGBdocwH6hwKKpPmWaPFoKwqAKmX5mUzk93KHW7kh";

const OTHER_WALLET =
  "Brxm2HSuCiS766hyLXZxECnnZHppvb2pZVavzvd6R8q8";

const ASSET =
  "FyKUWfQdkbEG3hER8KJKizwQFNqZm6a7TVDkUfVDkPiR";

const OTHER_ASSET =
  "AYEjp8J6HyXBr7mp424Au2DERdGHS8Ap9DugFyBkF1z6";

const COLLECTION =
  "BvGrvq4xRqTnan7djgLvSjDWrLz8KRiCFsqkty6FuYZ3";

const OTHER_COLLECTION =
  "HmnWH4u6nyUx7WfZrb1Taejcu3H1vmca7jbAMap2SNvK";

const HASH =
  buildPriveEvidenceHash({
	wallet: WALLET,
	assetId: ASSET,
	collection: COLLECTION,
  });

const OTHER_HASH =
  buildPriveEvidenceHash({
	wallet: WALLET,
	assetId: OTHER_ASSET,
	collection: COLLECTION,
  });

function existingRecord(
  overrides: Partial<{
	status: number;
	source: number;
	metadataHash: readonly number[];
  }> = {},
) {
  return {
	status:
	  overrides.status ??
	  RECORD_STATUS_ACTIVE,
	source:
	  overrides.source ??
	  SOURCE_PRIVE_COLLECTION_VERIFIED,
	metadataHash:
	  overrides.metadataHash ??
	  HASH,
  };
}

describe(
  "PRIVÉ synchronization policy",
  () => {
	it(
	  "builds a deterministic 32-byte evidence hash",
	  () => {
		const repeated =
		  buildPriveEvidenceHash({
			wallet: WALLET,
			assetId: ASSET,
			collection: COLLECTION,
		  });

		assert.equal(
		  HASH.length,
		  32,
		);

		assert.deepEqual(
		  repeated,
		  HASH,
		);
	  },
	);

	it(
	  "changes the evidence hash when ownership evidence changes",
	  () => {
		const walletHash =
		  buildPriveEvidenceHash({
			wallet: OTHER_WALLET,
			assetId: ASSET,
			collection: COLLECTION,
		  });

		const assetHash =
		  buildPriveEvidenceHash({
			wallet: WALLET,
			assetId: OTHER_ASSET,
			collection: COLLECTION,
		  });

		const collectionHash =
		  buildPriveEvidenceHash({
			wallet: WALLET,
			assetId: ASSET,
			collection:
			  OTHER_COLLECTION,
		  });

		assert.notDeepEqual(
		  walletHash,
		  HASH,
		);

		assert.notDeepEqual(
		  assetHash,
		  HASH,
		);

		assert.notDeepEqual(
		  collectionHash,
		  HASH,
		);
	  },
	);

	it(
	  "never mutates for an ineligible wallet",
	  () => {
		const decision =
		  planPriveSync({
			eligible: false,
			existing:
			  existingRecord({
				status:
				  RECORD_STATUS_ACTIVE,
			  }),
		  });

		assert.equal(
		  decision.action,
		  "skip-ineligible",
		);

		assert.equal(
		  decision.shouldMutate,
		  false,
		);
	  },
	);

	it(
	  "creates an Active record when no record exists",
	  () => {
		const decision =
		  planPriveSync({
			eligible: true,
			existing: null,
			expectedMetadataHash:
			  HASH,
		  });

		assert.equal(
		  decision.action,
		  "create-active",
		);

		assert.equal(
		  decision.shouldMutate,
		  true,
		);
	  },
	);

	it(
	  "does nothing when the Active record already has current evidence",
	  () => {
		const decision =
		  planPriveSync({
			eligible: true,
			existing:
			  existingRecord(),
			expectedMetadataHash:
			  HASH,
		  });

		assert.equal(
		  decision.action,
		  "no-op",
		);

		assert.equal(
		  decision.shouldMutate,
		  false,
		);
	  },
	);

	it(
	  "refreshes an Active record whose evidence changed",
	  () => {
		const decision =
		  planPriveSync({
			eligible: true,
			existing:
			  existingRecord({
				metadataHash:
				  OTHER_HASH,
			  }),
			expectedMetadataHash:
			  HASH,
		  });

		assert.equal(
		  decision.action,
		  "refresh-evidence",
		);

		assert.equal(
		  decision.shouldMutate,
		  true,
		);
	  },
	);

	it(
	  "activates a Pending collection-verification record",
	  () => {
		const decision =
		  planPriveSync({
			eligible: true,
			existing:
			  existingRecord({
				status:
				  RECORD_STATUS_PENDING,
			  }),
			expectedMetadataHash:
			  HASH,
		  });

		assert.equal(
		  decision.action,
		  "activate-pending",
		);

		assert.equal(
		  decision.shouldMutate,
		  true,
		);
	  },
	);

	it(
	  "requires manual review for a Suspended record",
	  () => {
		const decision =
		  planPriveSync({
			eligible: true,
			existing:
			  existingRecord({
				status:
				  RECORD_STATUS_SUSPENDED,
			  }),
			expectedMetadataHash:
			  HASH,
		  });

		assert.equal(
		  decision.action,
		  "manual-review",
		);

		assert.equal(
		  decision.shouldMutate,
		  false,
		);
	  },
	);

	it(
	  "requires manual review for a Revoked record",
	  () => {
		const decision =
		  planPriveSync({
			eligible: true,
			existing:
			  existingRecord({
				status:
				  RECORD_STATUS_REVOKED,
			  }),
			expectedMetadataHash:
			  HASH,
		  });

		assert.equal(
		  decision.action,
		  "manual-review",
		);

		assert.equal(
		  decision.shouldMutate,
		  false,
		);
	  },
	);

	it(
	  "requires manual review for an Expired record",
	  () => {
		const decision =
		  planPriveSync({
			eligible: true,
			existing:
			  existingRecord({
				status:
				  RECORD_STATUS_EXPIRED,
			  }),
			expectedMetadataHash:
			  HASH,
		  });

		assert.equal(
		  decision.action,
		  "manual-review",
		);

		assert.equal(
		  decision.shouldMutate,
		  false,
		);
	  },
	);

	it(
	  "preserves DAO-approved and manually approved records",
	  () => {
		const daoDecision =
		  planPriveSync({
			eligible: true,
			existing:
			  existingRecord({
				source:
				  SOURCE_DAO_APPROVED,
			  }),
			expectedMetadataHash:
			  HASH,
		  });

		const manualDecision =
		  planPriveSync({
			eligible: true,
			existing:
			  existingRecord({
				source:
				  SOURCE_MANUAL_COUNCIL,
			  }),
			expectedMetadataHash:
			  HASH,
		  });

		assert.equal(
		  daoDecision.action,
		  "preserve-authoritative-record",
		);

		assert.equal(
		  manualDecision.action,
		  "preserve-authoritative-record",
		);

		assert.equal(
		  daoDecision.shouldMutate,
		  false,
		);

		assert.equal(
		  manualDecision.shouldMutate,
		  false,
		);
	  },
	);

	it(
	  "rejects invalid existing record sources and statuses",
	  () => {
		assert.throws(
		  () =>
			planPriveSync({
			  eligible: true,
			  existing:
				existingRecord({
				  source: 3,
				}),
			  expectedMetadataHash:
				HASH,
			}),
		  /invalid source/,
		);

		assert.throws(
		  () =>
			planPriveSync({
			  eligible: true,
			  existing:
				existingRecord({
				  status: 99,
				}),
			  expectedMetadataHash:
				HASH,
			}),
		  /invalid status/,
		);
	  },
	);
  },
);
