import { strict as assert } from "node:assert";

import {
  PERSONA_RECORD_STATUS_ACTIVE,
  PERSONA_RECORD_STATUS_EXPIRED,
  PERSONA_RECORD_STATUS_PENDING,
  PERSONA_RECORD_STATUS_REVOKED,
  PERSONA_RECORD_STATUS_SUSPENDED,
  PERSONA_SOURCE_ATTESTATION,
  planPersonaSync,
} from "../scripts/shared/persona-sync-policy.ts";

const HASH =
  Array.from(
	Buffer.alloc(32, 7),
  );

const OTHER_HASH =
  Array.from(
	Buffer.alloc(32, 9),
  );

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
	  PERSONA_RECORD_STATUS_ACTIVE,
	source:
	  overrides.source ??
	  PERSONA_SOURCE_ATTESTATION,
	metadataHash:
	  overrides.metadataHash ??
	  HASH,
  };
}

describe(
  "Persona synchronization policy",
  () => {
	it(
	  "never mutates for an ineligible attestation",
	  () => {
		const decision =
		  planPersonaSync({
			eligible: false,
			existing:
			  existingRecord(),
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
		  planPersonaSync({
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
	  "does nothing for identical Active evidence",
	  () => {
		const decision =
		  planPersonaSync({
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
	  "refreshes changed Active evidence",
	  () => {
		const decision =
		  planPersonaSync({
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
	  "activates a Pending Persona record",
	  () => {
		const decision =
		  planPersonaSync({
			eligible: true,
			existing:
			  existingRecord({
				status:
				  PERSONA_RECORD_STATUS_PENDING,
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

	for (
	  const [
		statusName,
		status,
	  ] of [
		[
		  "Suspended",
		  PERSONA_RECORD_STATUS_SUSPENDED,
		],
		[
		  "Revoked",
		  PERSONA_RECORD_STATUS_REVOKED,
		],
		[
		  "Expired",
		  PERSONA_RECORD_STATUS_EXPIRED,
		],
	  ] as const
	) {
	  it(
		`requires manual review for a ${statusName} record`,
		() => {
		  const decision =
			planPersonaSync({
			  eligible: true,
			  existing:
				existingRecord({
				  status,
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
	}

	it(
	  "rejects an existing Persona record with the wrong source",
	  () => {
		assert.throws(
		  () =>
			planPersonaSync({
			  eligible: true,
			  existing:
				existingRecord({
				  source: 2,
				}),
			  expectedMetadataHash:
				HASH,
			}),
		  /invalid source/,
		);
	  },
	);

	it(
	  "rejects invalid statuses and malformed hashes",
	  () => {
		assert.throws(
		  () =>
			planPersonaSync({
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

		assert.throws(
		  () =>
			planPersonaSync({
			  eligible: true,
			  existing: null,
			  expectedMetadataHash:
				[1, 2, 3],
			}),
		  /exactly 32 bytes/,
		);
	  },
	);
  },
);
