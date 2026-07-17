import * as anchor from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import assert from "assert";

import {
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_PROGRAM_ID,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  METADATA_HASH_BYTES,
  NAME_BYTES,
  RECORD_STATUS_ACTIVE,
  RECORD_STATUS_PENDING,
  RECORD_STATUS_REVOKED,
  RECORD_STATUS_SUSPENDED,
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

describe("physis_eligibility_registry record transitions", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(
	program.programId.toBase58(),
	ELIGIBILITY_PROGRAM_ID,
  );

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

  async function expectRejects(
	promiseFactory: () => Promise<unknown>,
	label: string,
  ): Promise<void> {
	let rejected = false;

	try {
	  await promiseFactory();
	} catch {
	  rejected = true;
	}

	assert.strictEqual(
	  rejected,
	  true,
	  `Expected rejection: ${label}`,
	);
  }

  async function createFixture(
	recordStatus = RECORD_STATUS_ACTIVE,
  ) {
	const realm = Keypair.generate();

	const epochRegistry =
	  await initializeCanonicalEpochRegistry(realm.publicKey);

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

	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { pda: eligibilityRecord } =
	  findEligibilityRecordPda(
		program.programId,
		registry,
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
		recordStatus,
		ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		provider.wallet.publicKey,
		zeroBytes(METADATA_HASH_BYTES),
		0,
		0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		eligibilityRecord,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	return {
	  registry,
	  eligibilityClass,
	  eligibilityRecord,
	  subjectKey,
	};
  }

  async function suspendRecord(fixture: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	eligibilityRecord: PublicKey;
	subjectKey: number[];
  }): Promise<void> {
	await program.methods
	  .suspendEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		fixture.subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry: fixture.registry,
		eligibilityClass: fixture.eligibilityClass,
		eligibilityRecord: fixture.eligibilityRecord,
	  })
	  .rpc();
  }

  async function revokeRecord(fixture: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	eligibilityRecord: PublicKey;
	subjectKey: number[];
  }): Promise<void> {
	await program.methods
	  .revokeEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		fixture.subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry: fixture.registry,
		eligibilityClass: fixture.eligibilityClass,
		eligibilityRecord: fixture.eligibilityRecord,
	  })
	  .rpc();
  }

  it("rejects suspending an already suspended record", async () => {
	const fixture = await createFixture();

	await suspendRecord(fixture);

	await expectRejects(
	  () => suspendRecord(fixture),
	  "already suspended record cannot be suspended again",
	);
  });

  it("rejects suspending a revoked record", async () => {
	const fixture = await createFixture();

	await revokeRecord(fixture);

	await expectRejects(
	  () => suspendRecord(fixture),
	  "revoked record cannot become suspended",
	);

	const account =
	  await program.account.eligibilityRecord.fetch(
		fixture.eligibilityRecord,
	  );

	assert.strictEqual(
	  account.status,
	  RECORD_STATUS_REVOKED,
	);
  });

  it("allows suspending a pending record", async () => {
	const fixture = await createFixture(
	  RECORD_STATUS_PENDING,
	);

	await suspendRecord(fixture);

	const account =
	  await program.account.eligibilityRecord.fetch(
		fixture.eligibilityRecord,
	  );

	assert.strictEqual(
	  account.status,
	  RECORD_STATUS_SUSPENDED,
	);
  });

  it("allows revoking a suspended record", async () => {
	const fixture = await createFixture();

	await suspendRecord(fixture);
	await revokeRecord(fixture);

	const account =
	  await program.account.eligibilityRecord.fetch(
		fixture.eligibilityRecord,
	  );

	assert.strictEqual(
	  account.status,
	  RECORD_STATUS_REVOKED,
	);
  });

  it("rejects revoking an already revoked record", async () => {
	const fixture = await createFixture();

	await revokeRecord(fixture);

	await expectRejects(
	  () => revokeRecord(fixture),
	  "already revoked record cannot be revoked again",
	);

	const account =
	  await program.account.eligibilityRecord.fetch(
		fixture.eligibilityRecord,
	  );

	assert.strictEqual(
	  account.status,
	  RECORD_STATUS_REVOKED,
	);
  });
});
