import * as anchor from "@anchor-lang/core";
import { getEligibilityProgram } from "./helpers/eligibility-program.ts";
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

describe("physis_eligibility_registry pause controls", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

  function fixedBytes(value: string, length: number): number[] {
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

	assert.strictEqual(rejected, true, `Expected rejection: ${label}`);
  }

  async function initializeRegistry() {
	const realm = Keypair.generate();
	const epochRegistry = await initializeCanonicalEpochRegistry(realm.publicKey);

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

	return {
	  registry,
	};
  }

  async function createPriveClass(registry: PublicKey) {
	const { pda: eligibilityClass } = findEligibilityClassPda(
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
	  eligibilityClass,
	};
  }

  async function createPriveRecord(
	registry: PublicKey,
	eligibilityClass: PublicKey,
  ) {
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { pda: eligibilityRecord } = findEligibilityRecordPda(
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
		RECORD_STATUS_ACTIVE,
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
	  wallet,
	  subjectKey,
	  eligibilityRecord,
	};
  }

  async function pauseRegistry(
	registry: PublicKey,
	authority?: Keypair,
  ): Promise<void> {
	const builder = program.methods.pauseRegistry().accountsStrict({
	  authority: authority?.publicKey ?? provider.wallet.publicKey,
	  registry,
	});

	if (authority) {
	  await builder.signers([authority]).rpc();
	} else {
	  await builder.rpc();
	}
  }

  async function resumeRegistry(
	registry: PublicKey,
	authority?: Keypair,
  ): Promise<void> {
	const builder = program.methods.resumeRegistry().accountsStrict({
	  authority: authority?.publicKey ?? provider.wallet.publicKey,
	  registry,
	});

	if (authority) {
	  await builder.signers([authority]).rpc();
	} else {
	  await builder.rpc();
	}
  }

  async function disableClass(
	registry: PublicKey,
	eligibilityClass: PublicKey,
  ): Promise<void> {
	await program.methods
	  .disableEligibilityClass(CLASS_ID_PRIVE_MEMBER)
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
	  })
	  .rpc();
  }

  async function suspendRecord(params: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	eligibilityRecord: PublicKey;
	subjectKey: number[];
  }): Promise<void> {
	await program.methods
	  .suspendEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		params.subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass: params.eligibilityClass,
		eligibilityRecord: params.eligibilityRecord,
	  })
	  .rpc();
  }

  async function revokeRecord(params: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	eligibilityRecord: PublicKey;
	subjectKey: number[];
  }): Promise<void> {
	await program.methods
	  .revokeEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		params.subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass: params.eligibilityClass,
		eligibilityRecord: params.eligibilityRecord,
	  })
	  .rpc();
  }

  it("pauses and resumes the registry", async () => {
	const { registry } = await initializeRegistry();

	await pauseRegistry(registry);

	let account = await program.account.eligibilityRegistry.fetch(registry);
	assert.strictEqual(account.paused, true);

	await resumeRegistry(registry);

	account = await program.account.eligibilityRegistry.fetch(registry);
	assert.strictEqual(account.paused, false);
  });

  it("rejects pause from the wrong authority", async () => {
	const { registry } = await initializeRegistry();
	const wrongAuthority = Keypair.generate();

	await expectRejects(
	  () => pauseRegistry(registry, wrongAuthority),
	  "wrong authority cannot pause registry",
	);
  });

  it("rejects pausing an already paused registry", async () => {
	const { registry } = await initializeRegistry();

	await pauseRegistry(registry);

	await expectRejects(
	  () => pauseRegistry(registry),
	  "registry cannot be paused twice",
	);
  });

  it("rejects resume from the wrong authority", async () => {
	const { registry } = await initializeRegistry();
	const wrongAuthority = Keypair.generate();

	await pauseRegistry(registry);

	await expectRejects(
	  () => resumeRegistry(registry, wrongAuthority),
	  "wrong authority cannot resume registry",
	);
  });

  it("rejects resuming a registry that is not paused", async () => {
	const { registry } = await initializeRegistry();

	await expectRejects(
	  () => resumeRegistry(registry),
	  "active registry cannot be resumed",
	);
  });

  it("pause blocks eligibility class upsert", async () => {
	const { registry } = await initializeRegistry();

	await pauseRegistry(registry);

	await expectRejects(
	  () => createPriveClass(registry),
	  "paused registry blocks class upsert",
	);
  });

  it("pause blocks eligibility class disable", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	await pauseRegistry(registry);

	await expectRejects(
	  () => disableClass(registry, eligibilityClass),
	  "paused registry blocks class disable",
	);
  });

  it("pause blocks eligibility record upsert", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	await pauseRegistry(registry);

	await expectRejects(
	  () => createPriveRecord(registry, eligibilityClass),
	  "paused registry blocks record upsert",
	);
  });

  it("pause blocks eligibility record suspension", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const { eligibilityRecord, subjectKey } = await createPriveRecord(
	  registry,
	  eligibilityClass,
	);

	await pauseRegistry(registry);

	await expectRejects(
	  () =>
		suspendRecord({
		  registry,
		  eligibilityClass,
		  eligibilityRecord,
		  subjectKey,
		}),
	  "paused registry blocks record suspension",
	);
  });

  it("pause blocks eligibility record revocation", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const { eligibilityRecord, subjectKey } = await createPriveRecord(
	  registry,
	  eligibilityClass,
	);

	await pauseRegistry(registry);

	await expectRejects(
	  () =>
		revokeRecord({
		  registry,
		  eligibilityClass,
		  eligibilityRecord,
		  subjectKey,
		}),
	  "paused registry blocks record revocation",
	);
  });

  it("resume restores registry mutations", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const { eligibilityRecord, subjectKey } = await createPriveRecord(
	  registry,
	  eligibilityClass,
	);

	await pauseRegistry(registry);
	await resumeRegistry(registry);

	await suspendRecord({
	  registry,
	  eligibilityClass,
	  eligibilityRecord,
	  subjectKey,
	});

	const recordAccount =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(recordAccount.status, RECORD_STATUS_SUSPENDED);
  });
});
