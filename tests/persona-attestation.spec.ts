import { strict as assert } from "node:assert";

import {
  PERSONA_ATTESTATION_SCHEMA,
  PERSONA_ATTESTATION_SCHEMA_VERSION,
  buildPersonaEvidenceHash,
  evaluatePersonaAttestation,
  normalizePersonaAttestation,
  parsePersonaAttestation,
  type PersonaAttestation,
} from "../scripts/shared/persona-attestation.ts";

const NOW = 1_800_000_000;

const WALLET =
  "2vLMGBdocwH6hwKKpPmWaPFoKwqAKmX5mUzk93KHW7kh";

const OTHER_WALLET =
  "Brxm2HSuCiS766hyLXZxECnnZHppvb2pZVavzvd6R8q8";

const ATTESTATION_ID =
  "6d724f72-2a34-4fce-ae4d-663f6d18204a";

const PERSONA_USER_ID =
  "d336ca10-a903-4a7f-a147-f175a228018c";

function verifiedAttestation(
  overrides:
	Partial<PersonaAttestation> = {},
): PersonaAttestation {
  return {
	schema:
	  PERSONA_ATTESTATION_SCHEMA,
	schemaVersion:
	  PERSONA_ATTESTATION_SCHEMA_VERSION,
	attestationId:
	  ATTESTATION_ID,
	personaUserId:
	  PERSONA_USER_ID,
	wallet: WALLET,
	status: "verified",
	walletBindingConfirmed: true,
	verifiedAt: NOW - 60,
	expiresAt: NOW + 3600,
	revision: 1,
	issuer: "persona",
	...overrides,
  };
}

describe(
  "Persona attestation",
  () => {
	it(
	  "accepts a current verified wallet-bound attestation",
	  () => {
		const result =
		  evaluatePersonaAttestation(
			verifiedAttestation(),
			{
			  nowTs: NOW,
			},
		  );

		assert.equal(
		  result.eligible,
		  true,
		);

		assert.equal(
		  result.reason,
		  "verified",
		);

		assert.equal(
		  result.evidenceHash?.length,
		  32,
		);

		assert.equal(
		  result.attestation.wallet,
		  WALLET,
		);
	  },
	);

	it(
	  "builds deterministic evidence",
	  () => {
		const normalized =
		  normalizePersonaAttestation(
			verifiedAttestation(),
		  );

		const first =
		  buildPersonaEvidenceHash(
			normalized,
		  );

		const second =
		  buildPersonaEvidenceHash(
			normalized,
		  );

		assert.deepEqual(
		  first,
		  second,
		);

		assert.equal(
		  first.length,
		  32,
		);
	  },
	);

	it(
	  "changes evidence when the wallet or revision changes",
	  () => {
		const original =
		  evaluatePersonaAttestation(
			verifiedAttestation(),
			{
			  nowTs: NOW,
			},
		  );

		const changedWallet =
		  evaluatePersonaAttestation(
			verifiedAttestation({
			  wallet: OTHER_WALLET,
			}),
			{
			  nowTs: NOW,
			},
		  );

		const changedRevision =
		  evaluatePersonaAttestation(
			verifiedAttestation({
			  revision: 2,
			}),
			{
			  nowTs: NOW,
			},
		  );

		assert.notDeepEqual(
		  original.evidenceHash,
		  changedWallet.evidenceHash,
		);

		assert.notDeepEqual(
		  original.evidenceHash,
		  changedRevision.evidenceHash,
		);
	  },
	);

	it(
	  "returns ineligible for an unverified status",
	  () => {
		const result =
		  evaluatePersonaAttestation(
			verifiedAttestation({
			  status: "unverified",
			  verifiedAt: null,
			  expiresAt: null,
			}),
			{
			  nowTs: NOW,
			},
		  );

		assert.equal(
		  result.eligible,
		  false,
		);

		assert.equal(
		  result.reason,
		  "status-not-verified",
		);

		assert.equal(
		  result.evidenceHash,
		  null,
		);
	  },
	);

	it(
	  "returns ineligible when wallet binding is not confirmed",
	  () => {
		const result =
		  evaluatePersonaAttestation(
			verifiedAttestation({
			  walletBindingConfirmed:
				false,
			}),
			{
			  nowTs: NOW,
			},
		  );

		assert.equal(
		  result.eligible,
		  false,
		);

		assert.equal(
		  result.reason,
		  "wallet-binding-not-confirmed",
		);
	  },
	);

	it(
	  "returns ineligible for an expired attestation",
	  () => {
		const result =
		  evaluatePersonaAttestation(
			verifiedAttestation({
			  expiresAt: NOW - 1,
			}),
			{
			  nowTs: NOW,
			},
		  );

		assert.equal(
		  result.eligible,
		  false,
		);

		assert.equal(
		  result.reason,
		  "expired",
		);
	  },
	);

	it(
	  "rejects a verified attestation without verifiedAt",
	  () => {
		assert.throws(
		  () =>
			evaluatePersonaAttestation(
			  verifiedAttestation({
				verifiedAt: null,
			  }),
			  {
				nowTs: NOW,
			  },
			),
		  /requires verifiedAt/,
		);
	  },
	);

	it(
	  "rejects an attestation verified too far in the future",
	  () => {
		assert.throws(
		  () =>
			evaluatePersonaAttestation(
			  verifiedAttestation({
				verifiedAt:
				  NOW + 301,
				expiresAt:
				  NOW + 3600,
			  }),
			  {
				nowTs: NOW,
				maxFutureClockSkewSeconds:
				  300,
			  },
			),
		  /unreasonably far in the future/,
		);
	  },
	);

	it(
	  "rejects invalid expiry ordering",
	  () => {
		assert.throws(
		  () =>
			normalizePersonaAttestation(
			  verifiedAttestation({
				verifiedAt: NOW,
				expiresAt: NOW,
			  }),
			),
		  /later than verifiedAt/,
		);
	  },
	);

	it(
	  "rejects invalid wallet and UUID values",
	  () => {
		assert.throws(
		  () =>
			normalizePersonaAttestation(
			  verifiedAttestation({
				wallet:
				  "not-a-wallet",
			  }),
			),
		  /not a valid Solana address/,
		);

		assert.throws(
		  () =>
			normalizePersonaAttestation(
			  verifiedAttestation({
				personaUserId:
				  "not-a-uuid",
			  }),
			),
		  /canonical UUID/,
		);
	  },
	);

	it(
	  "rejects unsupported fields in a parsed envelope",
	  () => {
		const value = {
		  ...verifiedAttestation(),
		  email:
			"must-not-enter-attestation@example.com",
		};

		assert.throws(
		  () =>
			parsePersonaAttestation(
			  value,
			),
		  /Unsupported Persona attestation field: email/,
		);
	  },
	);
  },
);
