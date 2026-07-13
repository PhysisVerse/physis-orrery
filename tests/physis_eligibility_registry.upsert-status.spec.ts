import * as anchor from "@anchor-lang/core";
import {
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import assert from "assert";

import {
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  METADATA_HASH_BYTES,
  NAME_BYTES,
  RECORD_STATUS_ACTIVE,
  RECORD_STATUS_EXPIRED,
  RECORD_STATUS_PENDING,
  RECORD_STATUS_REVOKED,
  RECORD_STATUS_SUSPENDED,
  SUBJECT_KIND_WALLET,
} from "./helpers/eligibility-constants.ts";

import {
  findCanonicalEpochRegistryPda,
  findEligibilityClassPda,
  findEligibilityRecordPda,
  findEligibilityRegistryPda,
} from "./helpers/eligibility-pdas.ts";

import {
  getEligibilityProgram,
} from "./helpers/eligibility-program.ts";

describe("physis_eligibility_registry upsert status policy", () => {
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

  async function createFixture(): Promise<{
	registry: PublicKey;
	eligibilityClass: PublicKey;
  }> {
	const realm = Keypair.generate();

	const epochRegistry =
	  findCanonicalEpochRegistryPda(realm.publicKey);

	const { pda: registry } =
	  findEligibilityRegistryPda(
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

	const { pda: eligibilityClass } =
	  findEligibilityClassPda(
		program.programId,
		registry,
		CLASS_ID_PRIVE_MEMBER,
	  );

	await program.methods
	  .upsertEligibilityClass(
		CLASS_ID_PRIVE_MEMBER,
		fixedBytes("PRIVE_MEMBER", NAME_BYTES),
		fixedBytes("PRIVE", LABEL_BYTES),
		CLASS_KIND_PRIVE_MEMBER,
		CLASS_STATUS_ACTIVE,
		true,
		true,
		true,
		PublicKey.default,
		new anchor.BN(0),
		0,
		0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	return {
	  registry,
	  eligibilityClass,
	};
  }

  async function upsertWithStatus(
	fixture: {
	  registry: PublicKey;
	  eligibilityClass: PublicKey;
	},
	status: number,
  ): Promise<PublicKey> {
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { pda: eligibilityRecord } =
	  findEligibilityRecordPda(
		program.programId,
		fixture.registry,
		SUBJECT_KIND_WALLET,
		subjectKey,
		CLASS_ID_PRIVE_MEMBER,
	  );

	await program.methods
	  .upsertEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
		wallet,
		status,
		ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		provider.wallet.publicKey,
		zeroBytes(METADATA_HASH_BYTES),
		0,
		0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		registry: fixture.registry,
		eligibilityClass: fixture.eligibilityClass,
		eligibilityRecord,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	return eligibilityRecord;
  }

  it("accepts ACTIVE through record upsert", async () => {
	const fixture = await createFixture();

	const eligibilityRecord = await upsertWithStatus(
	  fixture,
	  RECORD_STATUS_ACTIVE,
	);

	const account =
	  await program.account.eligibilityRecord.fetch(
		eligibilityRecord,
	  );

	assert.strictEqual(
	  account.status,
	  RECORD_STATUS_ACTIVE,
	);
  });

  it("accepts PENDING through record upsert", async () => {
	const fixture = await createFixture();

	const eligibilityRecord = await upsertWithStatus(
	  fixture,
	  RECORD_STATUS_PENDING,
	);

	const account =
	  await program.account.eligibilityRecord.fetch(
		eligibilityRecord,
	  );

	assert.strictEqual(
	  account.status,
	  RECORD_STATUS_PENDING,
	);
  });

  it("rejects SUSPENDED through record upsert", async () => {
	const fixture = await createFixture();

	await expectAnchorError(
	  () =>
		upsertWithStatus(
		  fixture,
		  RECORD_STATUS_SUSPENDED,
		),
	  "InvalidRecordStatus",
	);
  });

  it("rejects REVOKED through record upsert", async () => {
	const fixture = await createFixture();

	await expectAnchorError(
	  () =>
		upsertWithStatus(
		  fixture,
		  RECORD_STATUS_REVOKED,
		),
	  "InvalidRecordStatus",
	);
  });

  it("rejects EXPIRED through record upsert", async () => {
	const fixture = await createFixture();

	await expectAnchorError(
	  () =>
		upsertWithStatus(
		  fixture,
		  RECORD_STATUS_EXPIRED,
		),
	  "InvalidRecordStatus",
	);
  });
});
