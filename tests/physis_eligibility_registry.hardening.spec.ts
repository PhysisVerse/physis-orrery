import * as anchor from "@anchor-lang/core";
import { getEligibilityProgram } from "./helpers/eligibility-program.ts";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import assert from "assert";

import {
  CLASS_ID_PERSONA_VERIFIED,
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PERSONA_VERIFIED,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_PROGRAM_ID,
  ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  METADATA_HASH_BYTES,
  NAME_BYTES,
  RECORD_STATUS_ACTIVE,
  SUBJECT_KIND_WALLET,
} from "./helpers/eligibility-constants.ts";

import {
  findCanonicalEpochRegistryPda,
  findEligibilityClassPda,
  findEligibilityRecordPda,
  findEligibilityRegistryPda,
} from "./helpers/eligibility-pdas.ts";

/*
 * These include Anchor's 8-byte account discriminator.
 *
 * EligibilityRegistry::LEN = 288
 * EligibilityClass::LEN    = 315
 * EligibilityRecord::LEN   = 385
 */
const ELIGIBILITY_REGISTRY_ACCOUNT_SPACE = 8 + 288;
const ELIGIBILITY_CLASS_ACCOUNT_SPACE = 8 + 315;
const ELIGIBILITY_RECORD_ACCOUNT_SPACE = 8 + 385;

describe("physis_eligibility_registry hardening", () => {
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
	const epochRegistry = findCanonicalEpochRegistryPda(realm.publicKey);

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
	  realm,
	  epochRegistry,
	  registry,
	};
  }

  async function createClass(params: {
	registry: PublicKey;
	classId: number;
	name: string;
	label: string;
	kind: number;
	governanceEligible: boolean;
	rewardsEligible: boolean;
	eligibilityClassOverride?: PublicKey;
  }) {
	const { pda: expectedEligibilityClass } = findEligibilityClassPda(
	  program.programId,
	  params.registry,
	  params.classId,
	);

	const eligibilityClass =
	  params.eligibilityClassOverride ?? expectedEligibilityClass;

	await program.methods
	  .upsertEligibilityClass(
		params.classId,
		fixedBytes(params.name, NAME_BYTES),
		fixedBytes(params.label, LABEL_BYTES),
		params.kind,
		CLASS_STATUS_ACTIVE,
		true,
		params.governanceEligible,
		params.rewardsEligible,
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

	return {
	  eligibilityClass,
	};
  }

  async function createPriveClass(registry: PublicKey) {
	return createClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  name: "PRIVE_MEMBER",
	  label: "PRIVE",
	  kind: CLASS_KIND_PRIVE_MEMBER,
	  governanceEligible: true,
	  rewardsEligible: true,
	});
  }

  async function createPersonaClass(registry: PublicKey) {
	return createClass({
	  registry,
	  classId: CLASS_ID_PERSONA_VERIFIED,
	  name: "PERSONA_VERIFIED",
	  label: "PERSONA",
	  kind: CLASS_KIND_PERSONA_VERIFIED,
	  governanceEligible: false,
	  rewardsEligible: false,
	});
  }

  async function createRecord(params: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	classId: number;
	wallet: PublicKey;
	source: number;
	eligibilityRecordOverride?: PublicKey;
  }) {
	const subjectKey = pubkeyBytes(params.wallet);

	const { pda: expectedEligibilityRecord } = findEligibilityRecordPda(
	  program.programId,
	  params.registry,
	  SUBJECT_KIND_WALLET,
	  subjectKey,
	  params.classId,
	);

	const eligibilityRecord =
	  params.eligibilityRecordOverride ?? expectedEligibilityRecord;

	await program.methods
	  .upsertEligibilityRecord(
		params.classId,
		SUBJECT_KIND_WALLET,
		subjectKey,
		params.wallet,
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

	return {
	  eligibilityRecord,
	  subjectKey,
	};
  }

  it("allocates the exact registry account size", async () => {
	const { registry } = await initializeRegistry();

	const accountInfo = await provider.connection.getAccountInfo(registry);

	assert.notStrictEqual(accountInfo, null);
	assert.strictEqual(
	  accountInfo!.data.length,
	  ELIGIBILITY_REGISTRY_ACCOUNT_SPACE,
	);
  });

  it("allocates the exact eligibility class account size", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	const accountInfo =
	  await provider.connection.getAccountInfo(eligibilityClass);

	assert.notStrictEqual(accountInfo, null);
	assert.strictEqual(
	  accountInfo!.data.length,
	  ELIGIBILITY_CLASS_ACCOUNT_SPACE,
	);
  });

  it("allocates the exact eligibility record account size", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;

	const { eligibilityRecord } = await createRecord({
	  registry,
	  eligibilityClass,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  wallet,
	  source: ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
	});

	const accountInfo =
	  await provider.connection.getAccountInfo(eligibilityRecord);

	assert.notStrictEqual(accountInfo, null);
	assert.strictEqual(
	  accountInfo!.data.length,
	  ELIGIBILITY_RECORD_ACCOUNT_SPACE,
	);
  });

  it("derives distinct class PDAs for distinct class IDs", async () => {
	const { registry } = await initializeRegistry();

	const { pda: priveClass } = findEligibilityClassPda(
	  program.programId,
	  registry,
	  CLASS_ID_PRIVE_MEMBER,
	);

	const { pda: personaClass } = findEligibilityClassPda(
	  program.programId,
	  registry,
	  CLASS_ID_PERSONA_VERIFIED,
	);

	assert.notStrictEqual(priveClass.toBase58(), personaClass.toBase58());
  });

  it("derives distinct record PDAs for the same wallet across classes", async () => {
	const { registry } = await initializeRegistry();
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { pda: priveRecord } = findEligibilityRecordPda(
	  program.programId,
	  registry,
	  SUBJECT_KIND_WALLET,
	  subjectKey,
	  CLASS_ID_PRIVE_MEMBER,
	);

	const { pda: personaRecord } = findEligibilityRecordPda(
	  program.programId,
	  registry,
	  SUBJECT_KIND_WALLET,
	  subjectKey,
	  CLASS_ID_PERSONA_VERIFIED,
	);

	assert.notStrictEqual(priveRecord.toBase58(), personaRecord.toBase58());
  });

  it("derives distinct record PDAs for the same subject across registries", async () => {
	const first = await initializeRegistry();
	const second = await initializeRegistry();

	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { pda: firstRecord } = findEligibilityRecordPda(
	  program.programId,
	  first.registry,
	  SUBJECT_KIND_WALLET,
	  subjectKey,
	  CLASS_ID_PRIVE_MEMBER,
	);

	const { pda: secondRecord } = findEligibilityRecordPda(
	  program.programId,
	  second.registry,
	  SUBJECT_KIND_WALLET,
	  subjectKey,
	  CLASS_ID_PRIVE_MEMBER,
	);

	assert.notStrictEqual(firstRecord.toBase58(), secondRecord.toBase58());
  });

  it("rejects a class PDA derived for the wrong class ID", async () => {
	const { registry } = await initializeRegistry();

	const { pda: wrongClassPda } = findEligibilityClassPda(
	  program.programId,
	  registry,
	  CLASS_ID_PERSONA_VERIFIED,
	);

	await expectRejects(
	  () =>
		createClass({
		  registry,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  name: "PRIVE_MEMBER",
		  label: "PRIVE",
		  kind: CLASS_KIND_PRIVE_MEMBER,
		  governanceEligible: true,
		  rewardsEligible: true,
		  eligibilityClassOverride: wrongClassPda,
		}),
	  "class PDA from a different class ID must be rejected",
	);
  });

  it("rejects a record PDA derived for the wrong subject", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	const wallet = Keypair.generate().publicKey;
	const otherWallet = Keypair.generate().publicKey;

	const { pda: wrongRecordPda } = findEligibilityRecordPda(
	  program.programId,
	  registry,
	  SUBJECT_KIND_WALLET,
	  pubkeyBytes(otherWallet),
	  CLASS_ID_PRIVE_MEMBER,
	);

	await expectRejects(
	  () =>
		createRecord({
		  registry,
		  eligibilityClass,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  wallet,
		  source: ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		  eligibilityRecordOverride: wrongRecordPda,
		}),
	  "record PDA from a different subject must be rejected",
	);
  });

  it("rejects an eligibility class belonging to another registry", async () => {
	const first = await initializeRegistry();
	const second = await initializeRegistry();

	const { eligibilityClass: secondRegistryClass } =
	  await createPriveClass(second.registry);

	const wallet = Keypair.generate().publicKey;

	await expectRejects(
	  () =>
		createRecord({
		  registry: first.registry,
		  eligibilityClass: secondRegistryClass,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  wallet,
		  source: ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		}),
	  "class from another registry must be rejected",
	);
  });

  it("counts multiple classes and records exactly once", async () => {
	const { registry } = await initializeRegistry();

	const { eligibilityClass: priveClass } =
	  await createPriveClass(registry);

	const { eligibilityClass: personaClass } =
	  await createPersonaClass(registry);

	const wallet = Keypair.generate().publicKey;

	await createRecord({
	  registry,
	  eligibilityClass: priveClass,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  wallet,
	  source: ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
	});

	await createRecord({
	  registry,
	  eligibilityClass: personaClass,
	  classId: CLASS_ID_PERSONA_VERIFIED,
	  wallet,
	  source: ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
	});

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	assert.strictEqual(registryAccount.classCount, 2);
	assert.strictEqual(registryAccount.recordCount.toNumber(), 2);
  });
});
