import * as anchor from "@anchor-lang/core";
import {
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import assert from "assert";

import {
  CLASS_ID_PERSONA_VERIFIED,
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PERSONA_VERIFIED,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
  ELIGIBILITY_SOURCE_MANUAL_COUNCIL_DEPRECATED,
  ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
  ELIGIBILITY_SOURCE_UNKNOWN,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  METADATA_HASH_BYTES,
  NAME_BYTES,
  RECORD_STATUS_ACTIVE,
  SUBJECT_KIND_EXTERNAL_ATTESTATION,
  SUBJECT_KIND_PERSONA_HASH,
  SUBJECT_KIND_WALLET,
} from "./helpers/eligibility-constants.ts";

import {
  findEligibilityClassPda,
  findEligibilityRecordPda,
  findEligibilityRegistryPda,
} from "./helpers/eligibility-pdas.ts";

import {
  initializeCanonicalEpochRegistry,
} from "./helpers/epoch-registry-fixture.ts";

import {
  getEligibilityProgram,
} from "./helpers/eligibility-program.ts";

describe("physis_eligibility_registry record policy", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  function fixedBytes(
	value: string,
	length: number,
  ): number[] {
	const bytes = Buffer.alloc(length);
	bytes.write(value, "utf8");
	return Array.from(bytes);
  }

  function zeroBytes(length: number): number[] {
	return Array.from(Buffer.alloc(length));
  }

  function pubkeyBytes(pubkey: PublicKey): number[] {
	return Array.from(pubkey.toBytes());
  }

  async function expectAnchorError(
	promiseFactory: () => Promise<unknown>,
	expectedCode: string,
  ): Promise<void> {
	try {
	  await promiseFactory();
	} catch (error: unknown) {
	  const code = (
		error as {
		  error?: {
			errorCode?: {
			  code?: string;
			};
		  };
		}
	  ).error?.errorCode?.code;

	  assert.strictEqual(
		code,
		expectedCode,
		`Expected Anchor error ${expectedCode}, received ${code}`,
	  );

	  return;
	}

	assert.fail(
	  `Expected Anchor error ${expectedCode}, but transaction succeeded`,
	);
  }

  async function initializeRegistry(): Promise<PublicKey> {
	const realm = Keypair.generate();

	const epochRegistry =
	  await initializeCanonicalEpochRegistry(realm.publicKey);

	const { pda: registry } = findEligibilityRegistryPda(
	  program.programId,
	  realm.publicKey,
	);

	await program.methods
	  .initializeRegistry(GOVERNANCE_MODE_PRIVE_ONLY)
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		realm: realm.publicKey,
		epochRegistry,
		registry,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	return registry;
  }

  async function createClass(params: {
	registry: PublicKey;
	classId: number;
	kind: number;
  }): Promise<PublicKey> {
	const { pda: eligibilityClass } =
	  findEligibilityClassPda(
		program.programId,
		params.registry,
		params.classId,
	  );

	const isPrive =
	  params.classId === CLASS_ID_PRIVE_MEMBER;

	await program.methods
	  .upsertEligibilityClass(
		params.classId,
		fixedBytes(
		  isPrive
			? "PRIVE_MEMBER"
			: "PERSONA_VERIFIED",
		  NAME_BYTES,
		),
		fixedBytes(
		  isPrive ? "PRIVE" : "PERSONA",
		  LABEL_BYTES,
		),
		params.kind,
		CLASS_STATUS_ACTIVE,
		true,
		isPrive,
		isPrive,
		PublicKey.default,
		new anchor.BN(0),
		0,
		0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	return eligibilityClass;
  }

  async function upsertRecord(params: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	classId: number;
	source: number;
	subjectKind?: number;
	subjectKey?: number[];
	wallet?: PublicKey;
  }): Promise<PublicKey> {
	const wallet =
	  params.wallet ?? Keypair.generate().publicKey;

	const subjectKind =
	  params.subjectKind ?? SUBJECT_KIND_WALLET;

	const subjectKey =
	  params.subjectKey ?? pubkeyBytes(wallet);

	const { pda: eligibilityRecord } =
	  findEligibilityRecordPda(
		program.programId,
		params.registry,
		subjectKind,
		subjectKey,
		params.classId,
	  );

	await program.methods
	  .upsertEligibilityRecord(
		params.classId,
		subjectKind,
		subjectKey,
		wallet,
		RECORD_STATUS_ACTIVE,
		params.source,
		provider.wallet.publicKey,
		zeroBytes(METADATA_HASH_BYTES),
		0,
		0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass: params.eligibilityClass,
		eligibilityRecord,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	return eligibilityRecord;
  }

  async function createPriveFixture() {
	const registry = await initializeRegistry();

	const eligibilityClass = await createClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  kind: CLASS_KIND_PRIVE_MEMBER,
	});

	return {
	  registry,
	  eligibilityClass,
	};
  }

  async function createPersonaFixture() {
	const registry = await initializeRegistry();

	const eligibilityClass = await createClass({
	  registry,
	  classId: CLASS_ID_PERSONA_VERIFIED,
	  kind: CLASS_KIND_PERSONA_VERIFIED,
	});

	return {
	  registry,
	  eligibilityClass,
	};
  }

  it("accepts PRIVÉ collection attestation for PRIVE_MEMBER", async () => {
	const fixture = await createPriveFixture();

	const eligibilityRecord = await upsertRecord({
	  ...fixture,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  source:
		ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
	});

	const account =
	  await program.account.eligibilityRecord.fetch(
		eligibilityRecord,
	  );

	assert.strictEqual(
	  account.source,
	  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
	);
  });

  it("accepts DAO governance override for PRIVE_MEMBER", async () => {
	const fixture = await createPriveFixture();

	const eligibilityRecord = await upsertRecord({
	  ...fixture,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  source: ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
	});

	const account =
	  await program.account.eligibilityRecord.fetch(
		eligibilityRecord,
	  );

	assert.strictEqual(
	  account.source,
	  ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
	);
  });

  it(
    "rejects the deprecated manual Council source",
    async () => {
      const fixture =
        await createPriveFixture();

      await expectAnchorError(
        () =>
          upsertRecord({
            ...fixture,
            classId:
              CLASS_ID_PRIVE_MEMBER,
            source:
              ELIGIBILITY_SOURCE_MANUAL_COUNCIL_DEPRECATED,
          }),
        "InvalidEligibilitySource",
      );
    },
  );

  it("accepts Persona attestation for PERSONA_VERIFIED", async () => {
	const fixture = await createPersonaFixture();

	const eligibilityRecord = await upsertRecord({
	  ...fixture,
	  classId: CLASS_ID_PERSONA_VERIFIED,
	  source: ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
	});

	const account =
	  await program.account.eligibilityRecord.fetch(
		eligibilityRecord,
	  );

	assert.strictEqual(
	  account.source,
	  ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
	);
  });

  it("rejects Persona-hash subjects in v1", async () => {
	const fixture = await createPersonaFixture();
	const wallet = Keypair.generate().publicKey;

	await expectAnchorError(
	  () =>
		upsertRecord({
		  ...fixture,
		  classId: CLASS_ID_PERSONA_VERIFIED,
		  source:
			ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
		  subjectKind: SUBJECT_KIND_PERSONA_HASH,
		  subjectKey: pubkeyBytes(
			Keypair.generate().publicKey,
		  ),
		  wallet,
		}),
	  "InvalidSubjectKind",
	);
  });

  it("rejects external-attestation subjects in v1", async () => {
	const fixture = await createPersonaFixture();
	const wallet = Keypair.generate().publicKey;

	await expectAnchorError(
	  () =>
		upsertRecord({
		  ...fixture,
		  classId: CLASS_ID_PERSONA_VERIFIED,
		  source:
			ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
		  subjectKind:
			SUBJECT_KIND_EXTERNAL_ATTESTATION,
		  subjectKey: pubkeyBytes(
			Keypair.generate().publicKey,
		  ),
		  wallet,
		}),
	  "InvalidSubjectKind",
	);
  });

  it("rejects Persona attestation for PRIVE_MEMBER", async () => {
	const fixture = await createPriveFixture();

	await expectAnchorError(
	  () =>
		upsertRecord({
		  ...fixture,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  source:
			ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
		}),
	  "EligibilitySourceClassMismatch",
	);
  });

  it("rejects PRIVÉ collection attestation for PERSONA_VERIFIED", async () => {
	const fixture = await createPersonaFixture();

	await expectAnchorError(
	  () =>
		upsertRecord({
		  ...fixture,
		  classId: CLASS_ID_PERSONA_VERIFIED,
		  source:
			ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
		}),
	  "EligibilitySourceClassMismatch",
	);
  });

  it("rejects DAO governance override for PERSONA_VERIFIED", async () => {
	const fixture = await createPersonaFixture();

	await expectAnchorError(
	  () =>
		upsertRecord({
		  ...fixture,
		  classId: CLASS_ID_PERSONA_VERIFIED,
		  source: ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
		}),
	  "EligibilitySourceClassMismatch",
	);
  });

  it("rejects the deprecated manual Council source for PERSONA_VERIFIED", async () => {
	const fixture = await createPersonaFixture();

	await expectAnchorError(
	  () =>
		upsertRecord({
		  ...fixture,
		  classId: CLASS_ID_PERSONA_VERIFIED,
		  source:
			ELIGIBILITY_SOURCE_MANUAL_COUNCIL_DEPRECATED,
		}),
	  "InvalidEligibilitySource",
	);
  });

  it("rejects the UNKNOWN source sentinel", async () => {
	const fixture = await createPriveFixture();

	await expectAnchorError(
	  () =>
		upsertRecord({
		  ...fixture,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  source: ELIGIBILITY_SOURCE_UNKNOWN,
		}),
	  "InvalidEligibilitySource",
	);
  });
});
