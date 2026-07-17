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
  CLASS_STATUS_DISABLED,
  ELIGIBILITY_CLASS_VERSION,
  ELIGIBILITY_PROGRAM_ID,
  ELIGIBILITY_RECORD_VERSION,
  ELIGIBILITY_REGISTRY_VERSION,
  ELIGIBILITY_SOURCE_DAO_APPROVED,
  ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  METADATA_HASH_BYTES,
  NAME_BYTES,
  RECORD_STATUS_ACTIVE,
  RECORD_STATUS_PENDING,
  RECORD_STATUS_REVOKED,
  RECORD_STATUS_SUSPENDED,
  SUBJECT_KEY_BYTES,
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

describe("physis_eligibility_registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

  function createFakeRealm(): Keypair {
	return Keypair.generate();
  }

  function fixedBytes(value: string, length: number): number[] {
	const bytes = Buffer.alloc(length);
	bytes.write(value, "utf8");
	return Array.from(bytes);
  }

  function zeroBytes(length: number): number[] {
	return Array.from(Buffer.alloc(length));
  }

  function bytesToTrimmedString(bytes: number[]): string {
	return Buffer.from(bytes).toString("utf8").replace(/\0+$/g, "");
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

  async function initializeEligibilityRegistry(params?: {
	realm?: Keypair;
	epochRegistry?: PublicKey;
	governanceMode?: number;
  }) {
	const realm = params?.realm ?? createFakeRealm();

	const epochRegistry =
	  params?.epochRegistry ??
	  await initializeCanonicalEpochRegistry(realm.publicKey);

	const { pda: registry, bump } = findEligibilityRegistryPda(
	  program.programId,
	  realm.publicKey,
	);

	await program.methods
	  .initializeRegistry(
		params?.governanceMode ?? GOVERNANCE_MODE_PRIVE_ONLY,
	  )
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
	  bump,
	};
  }

  async function upsertEligibilityClass(params?: {
	registry?: PublicKey;
	authority?: Keypair;
	classId?: number;
	name?: string;
	label?: string;
	kind?: number;
	status?: number;
	enabled?: boolean;
	governanceEligible?: boolean;
	rewardsEligible?: boolean;
	gateMint?: PublicKey;
	minAmount?: number;
	validFromEpochId?: number;
	validUntilEpochId?: number;
  }) {
	const registry =
	  params?.registry ?? (await initializeEligibilityRegistry()).registry;

	const classId = params?.classId ?? CLASS_ID_PRIVE_MEMBER;

	const { pda: eligibilityClass, bump } = findEligibilityClassPda(
	  program.programId,
	  registry,
	  classId,
	);

	const builder = program.methods
	  .upsertEligibilityClass(
		classId,
		fixedBytes(params?.name ?? "PRIVE_MEMBER", NAME_BYTES),
		fixedBytes(params?.label ?? "PRIVE", LABEL_BYTES),
		params?.kind ?? CLASS_KIND_PRIVE_MEMBER,
		params?.status ?? CLASS_STATUS_ACTIVE,
		params?.enabled ?? true,
		params?.governanceEligible ?? true,
		params?.rewardsEligible ?? true,
		params?.gateMint ?? PublicKey.default,
		new anchor.BN(params?.minAmount ?? 0),
		params?.validFromEpochId ?? 0,
		params?.validUntilEpochId ?? 0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: params?.authority?.publicKey ?? provider.wallet.publicKey,
		registry,
		eligibilityClass,
		systemProgram: SystemProgram.programId,
	  });

	if (params?.authority) {
	  await builder.signers([params.authority]).rpc();
	} else {
	  await builder.rpc();
	}

	return {
	  registry,
	  eligibilityClass,
	  classId,
	  bump,
	};
  }

  async function disableEligibilityClass(params: {
	registry: PublicKey;
	classId: number;
	authority?: Keypair;
  }) {
	const { pda: eligibilityClass } = findEligibilityClassPda(
	  program.programId,
	  params.registry,
	  params.classId,
	);

	const builder = program.methods
	  .disableEligibilityClass(params.classId)
	  .accountsStrict({
		authority: params.authority?.publicKey ?? provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass,
	  });

	if (params.authority) {
	  await builder.signers([params.authority]).rpc();
	} else {
	  await builder.rpc();
	}

	return {
	  eligibilityClass,
	};
  }

  async function createPriveClass(registry: PublicKey) {
	return upsertEligibilityClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  name: "PRIVE_MEMBER",
	  label: "PRIVE",
	  kind: CLASS_KIND_PRIVE_MEMBER,
	  status: CLASS_STATUS_ACTIVE,
	  enabled: true,
	  governanceEligible: true,
	  rewardsEligible: true,
	});
  }

  async function createPersonaClass(registry: PublicKey) {
	return upsertEligibilityClass({
	  registry,
	  classId: CLASS_ID_PERSONA_VERIFIED,
	  name: "PERSONA_VERIFIED",
	  label: "PERSONA",
	  kind: CLASS_KIND_PERSONA_VERIFIED,
	  status: CLASS_STATUS_ACTIVE,
	  enabled: true,
	  governanceEligible: false,
	  rewardsEligible: false,
	});
  }

  async function upsertEligibilityRecord(params: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	classId?: number;
	authority?: Keypair;
	subjectKind?: number;
	subjectKey?: number[];
	wallet?: PublicKey;
	status?: number;
	source?: number;
	issuer?: PublicKey;
	metadataHash?: number[];
	validFromEpochId?: number;
	validUntilEpochId?: number;
  }) {
	const wallet = params.wallet ?? Keypair.generate().publicKey;
	const subjectKind = params.subjectKind ?? SUBJECT_KIND_WALLET;
	const subjectKey = params.subjectKey ?? pubkeyBytes(wallet);
	const classId = params.classId ?? CLASS_ID_PRIVE_MEMBER;

	const { pda: eligibilityRecord, bump } = findEligibilityRecordPda(
	  program.programId,
	  params.registry,
	  subjectKind,
	  subjectKey,
	  classId,
	);

	const builder = program.methods
	  .upsertEligibilityRecord(
		classId,
		subjectKind,
		subjectKey,
		wallet,
		params.status ?? RECORD_STATUS_ACTIVE,
		params.source ?? ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		params.issuer ?? provider.wallet.publicKey,
		params.metadataHash ?? zeroBytes(METADATA_HASH_BYTES),
		params.validFromEpochId ?? 0,
		params.validUntilEpochId ?? 0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: params.authority?.publicKey ?? provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass: params.eligibilityClass,
		eligibilityRecord,
		systemProgram: SystemProgram.programId,
	  });

	if (params.authority) {
	  await builder.signers([params.authority]).rpc();
	} else {
	  await builder.rpc();
	}

	return {
	  eligibilityRecord,
	  subjectKind,
	  subjectKey,
	  wallet,
	  classId,
	  bump,
	};
  }

  async function suspendEligibilityRecord(params: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	subjectKey: number[];
	classId?: number;
	subjectKind?: number;
	authority?: Keypair;
  }) {
	const classId = params.classId ?? CLASS_ID_PRIVE_MEMBER;
	const subjectKind = params.subjectKind ?? SUBJECT_KIND_WALLET;

	const { pda: eligibilityRecord } = findEligibilityRecordPda(
	  program.programId,
	  params.registry,
	  subjectKind,
	  params.subjectKey,
	  classId,
	);

	const builder = program.methods
	  .suspendEligibilityRecord(
		classId,
		subjectKind,
		params.subjectKey,
	  )
	  .accountsStrict({
		authority: params.authority?.publicKey ?? provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass: params.eligibilityClass,
		eligibilityRecord,
	  });

	if (params.authority) {
	  await builder.signers([params.authority]).rpc();
	} else {
	  await builder.rpc();
	}

	return {
	  eligibilityRecord,
	};
  }

  async function revokeEligibilityRecord(params: {
	registry: PublicKey;
	eligibilityClass: PublicKey;
	subjectKey: number[];
	classId?: number;
	subjectKind?: number;
	authority?: Keypair;
  }) {
	const classId = params.classId ?? CLASS_ID_PRIVE_MEMBER;
	const subjectKind = params.subjectKind ?? SUBJECT_KIND_WALLET;

	const { pda: eligibilityRecord } = findEligibilityRecordPda(
	  program.programId,
	  params.registry,
	  subjectKind,
	  params.subjectKey,
	  classId,
	);

	const builder = program.methods
	  .revokeEligibilityRecord(
		classId,
		subjectKind,
		params.subjectKey,
	  )
	  .accountsStrict({
		authority: params.authority?.publicKey ?? provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass: params.eligibilityClass,
		eligibilityRecord,
	  });

	if (params.authority) {
	  await builder.signers([params.authority]).rpc();
	} else {
	  await builder.rpc();
	}

	return {
	  eligibilityRecord,
	};
  }

  it("initializes the eligibility registry", async () => {
	const { realm, epochRegistry, registry, bump } =
	  await initializeEligibilityRegistry();

	const account = await program.account.eligibilityRegistry.fetch(registry);

	assert.strictEqual(account.version, ELIGIBILITY_REGISTRY_VERSION);
	assert.strictEqual(account.realm.toBase58(), realm.publicKey.toBase58());

	assert.strictEqual(
	  account.authority.toBase58(),
	  provider.wallet.publicKey.toBase58(),
	);

	assert.strictEqual(
	  account.epochRegistry.toBase58(),
	  epochRegistry.toBase58(),
	);

	assert.strictEqual(
	  account.governanceMode,
	  GOVERNANCE_MODE_PRIVE_ONLY,
	);

	assert.strictEqual(account.paused, false);
	assert.strictEqual(account.classCount, 0);
	assert.strictEqual(account.recordCount.toNumber(), 0);
	assert.strictEqual(account.bump, bump);

	assert.ok(account.createdTs.toNumber() > 0);
	assert.ok(account.createdSlot.toNumber() > 0);
	assert.ok(account.createdSolanaEpoch.toNumber() >= 0);

	assert.strictEqual(
	  account.updatedTs.toNumber(),
	  account.createdTs.toNumber(),
	);

	assert.strictEqual(
	  account.updatedSlot.toNumber(),
	  account.createdSlot.toNumber(),
	);

	assert.strictEqual(
	  account.updatedSolanaEpoch.toNumber(),
	  account.createdSolanaEpoch.toNumber(),
	);
  });

  it("derives the registry PDA from realm", async () => {
	const realm = createFakeRealm();

	const { pda: expectedRegistry } = findEligibilityRegistryPda(
	  program.programId,
	  realm.publicKey,
	);

	const { registry } = await initializeEligibilityRegistry({ realm });

	assert.strictEqual(
	  registry.toBase58(),
	  expectedRegistry.toBase58(),
	);
  });

  it("rejects invalid governance mode", async () => {
	await expectRejects(
	  () =>
		initializeEligibilityRegistry({
		  governanceMode: 255,
		}),
	  "invalid governance mode rejected",
	);
  });

  it("rejects duplicate initialize for the same realm", async () => {
	const realm = createFakeRealm();

	const epochRegistry =
	  await initializeCanonicalEpochRegistry(realm.publicKey);

	await initializeEligibilityRegistry({
	  realm,
	  epochRegistry,
	});

	await expectRejects(
	  () =>
		initializeEligibilityRegistry({
		  realm,
		  epochRegistry,
		}),
	  "duplicate registry initialize rejected",
	);
  });

  it("creates the PRIVE_MEMBER eligibility class", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass, bump } = await createPriveClass(registry);

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const classAccount =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	assert.strictEqual(registryAccount.classCount, 1);
	assert.strictEqual(classAccount.version, ELIGIBILITY_CLASS_VERSION);
	assert.strictEqual(
	  classAccount.registry.toBase58(),
	  registry.toBase58(),
	);
	assert.strictEqual(classAccount.classId, CLASS_ID_PRIVE_MEMBER);

	assert.strictEqual(
	  bytesToTrimmedString(classAccount.name),
	  "PRIVE_MEMBER",
	);

	assert.strictEqual(
	  bytesToTrimmedString(classAccount.label),
	  "PRIVE",
	);

	assert.strictEqual(classAccount.kind, CLASS_KIND_PRIVE_MEMBER);
	assert.strictEqual(classAccount.status, CLASS_STATUS_ACTIVE);
	assert.strictEqual(classAccount.enabled, true);
	assert.strictEqual(classAccount.governanceEligible, true);
	assert.strictEqual(classAccount.rewardsEligible, true);

	assert.strictEqual(
	  classAccount.gateMint.toBase58(),
	  PublicKey.default.toBase58(),
	);

	assert.strictEqual(classAccount.minAmount.toNumber(), 0);
	assert.strictEqual(classAccount.validFromEpochId, 0);
	assert.strictEqual(classAccount.validUntilEpochId, 0);
	assert.strictEqual(classAccount.bump, bump);

	assert.ok(classAccount.createdTs.toNumber() > 0);
	assert.ok(classAccount.createdSlot.toNumber() > 0);
	assert.ok(classAccount.createdSolanaEpoch.toNumber() >= 0);
  });

  it("creates the PERSONA_VERIFIED eligibility class", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPersonaClass(registry);

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const classAccount =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	assert.strictEqual(registryAccount.classCount, 1);
	assert.strictEqual(classAccount.version, ELIGIBILITY_CLASS_VERSION);

	assert.strictEqual(
	  classAccount.registry.toBase58(),
	  registry.toBase58(),
	);

	assert.strictEqual(
	  classAccount.classId,
	  CLASS_ID_PERSONA_VERIFIED,
	);

	assert.strictEqual(
	  bytesToTrimmedString(classAccount.name),
	  "PERSONA_VERIFIED",
	);

	assert.strictEqual(
	  bytesToTrimmedString(classAccount.label),
	  "PERSONA",
	);

	assert.strictEqual(
	  classAccount.kind,
	  CLASS_KIND_PERSONA_VERIFIED,
	);

	assert.strictEqual(classAccount.status, CLASS_STATUS_ACTIVE);
	assert.strictEqual(classAccount.enabled, true);
	assert.strictEqual(classAccount.governanceEligible, false);
	assert.strictEqual(classAccount.rewardsEligible, false);
  });

  it("updates an existing eligibility class without incrementing class_count", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	let registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	assert.strictEqual(registryAccount.classCount, 1);

	await upsertEligibilityClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  name: "PRIVE_MEMBER",
	  label: "PRIVE_V2",
	  kind: CLASS_KIND_PRIVE_MEMBER,
	  status: CLASS_STATUS_ACTIVE,
	  enabled: true,
	  governanceEligible: true,
	  rewardsEligible: false,
	  minAmount: 42,
	  validFromEpochId: 202602,
	  validUntilEpochId: 202603,
	});

	registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const classAccount =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	assert.strictEqual(registryAccount.classCount, 1);

	assert.strictEqual(
	  bytesToTrimmedString(classAccount.label),
	  "PRIVE_V2",
	);

	assert.strictEqual(classAccount.rewardsEligible, false);
	assert.strictEqual(classAccount.minAmount.toNumber(), 42);
	assert.strictEqual(classAccount.validFromEpochId, 202602);
	assert.strictEqual(classAccount.validUntilEpochId, 202603);

	assert.ok(
	  classAccount.updatedSlot.toNumber() >=
		classAccount.createdSlot.toNumber(),
	);
  });

  it("disables an eligibility class without changing class_count", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	const beforeRegistry =
	  await program.account.eligibilityRegistry.fetch(registry);

	const beforeClass =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	await disableEligibilityClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	});

	const afterRegistry =
	  await program.account.eligibilityRegistry.fetch(registry);

	const afterClass =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	assert.strictEqual(beforeRegistry.classCount, 1);
	assert.strictEqual(afterRegistry.classCount, 1);
	assert.strictEqual(beforeClass.status, CLASS_STATUS_ACTIVE);
	assert.strictEqual(beforeClass.enabled, true);
	assert.strictEqual(afterClass.status, CLASS_STATUS_DISABLED);
	assert.strictEqual(afterClass.enabled, false);
  });

  it("creates a wallet PRIVE_MEMBER eligibility record", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;

	const { eligibilityRecord, bump, subjectKey } =
	  await upsertEligibilityRecord({
		registry,
		eligibilityClass,
		classId: CLASS_ID_PRIVE_MEMBER,
		wallet,
		subjectKey: pubkeyBytes(wallet),
		status: RECORD_STATUS_ACTIVE,
		source: ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		issuer: provider.wallet.publicKey,
	  });

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const recordAccount =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(registryAccount.recordCount.toNumber(), 1);
	assert.strictEqual(recordAccount.version, ELIGIBILITY_RECORD_VERSION);

	assert.strictEqual(
	  recordAccount.registry.toBase58(),
	  registry.toBase58(),
	);

	assert.strictEqual(
	  recordAccount.eligibilityClass.toBase58(),
	  eligibilityClass.toBase58(),
	);

	assert.strictEqual(recordAccount.classId, CLASS_ID_PRIVE_MEMBER);
	assert.strictEqual(recordAccount.subjectKind, SUBJECT_KIND_WALLET);
	assert.deepStrictEqual(recordAccount.subjectKey, subjectKey);
	assert.strictEqual(recordAccount.wallet.toBase58(), wallet.toBase58());
	assert.strictEqual(recordAccount.status, RECORD_STATUS_ACTIVE);

	assert.strictEqual(
	  recordAccount.source,
	  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
	);

	assert.strictEqual(recordAccount.bump, bump);

	assert.ok(
	  recordAccount.evidenceIssuedAt.gt(
	    new anchor.BN(0),
	  ),
	);

	assert.strictEqual(
	  recordAccount.evidenceExpiresAt.toString(),
	  "0",
	);
  });

  it("creates a wallet PERSONA_VERIFIED eligibility record", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPersonaClass(registry);
	const wallet = Keypair.generate().publicKey;

	const { eligibilityRecord } = await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  classId: CLASS_ID_PERSONA_VERIFIED,
	  wallet,
	  subjectKey: pubkeyBytes(wallet),
	  status: RECORD_STATUS_ACTIVE,
	  source: ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
	});

	const recordAccount =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(
	  recordAccount.classId,
	  CLASS_ID_PERSONA_VERIFIED,
	);

	assert.strictEqual(recordAccount.status, RECORD_STATUS_ACTIVE);

	assert.strictEqual(
	  recordAccount.source,
	  ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
	);
  });

  it("updates an existing eligibility record without incrementing record_count", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;

	const { eligibilityRecord } = await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey: pubkeyBytes(wallet),
	});

	await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey: pubkeyBytes(wallet),
	  status: RECORD_STATUS_PENDING,
	  source: ELIGIBILITY_SOURCE_DAO_APPROVED,
	  metadataHash: fixedBytes("record-update", METADATA_HASH_BYTES),
	  validFromEpochId: 202602,
	  validUntilEpochId: 202603,
	});

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const recordAccount =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(registryAccount.recordCount.toNumber(), 1);
	assert.strictEqual(recordAccount.status, RECORD_STATUS_PENDING);
	assert.strictEqual(
	  recordAccount.source,
	  ELIGIBILITY_SOURCE_DAO_APPROVED,
	);
	assert.strictEqual(recordAccount.validFromEpochId, 202602);
	assert.strictEqual(recordAccount.validUntilEpochId, 202603);
  });

  it("suspends an active eligibility record without changing record_count", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { eligibilityRecord } = await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	});

	const before =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	await suspendEligibilityRecord({
	  registry,
	  eligibilityClass,
	  subjectKey,
	});

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const after =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(registryAccount.recordCount.toNumber(), 1);
	assert.strictEqual(after.status, RECORD_STATUS_SUSPENDED);

	assert.strictEqual(
	  after.createdTs.toString(),
	  before.createdTs.toString(),
	);

	assert.strictEqual(
	  after.createdSlot.toString(),
	  before.createdSlot.toString(),
	);

	assert.ok(
	  after.updatedSlot.toNumber() >= before.updatedSlot.toNumber(),
	);
  });

  it("reactivates a suspended record through upsert", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { eligibilityRecord } = await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	});

	await suspendEligibilityRecord({
	  registry,
	  eligibilityClass,
	  subjectKey,
	});

	await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	  status: RECORD_STATUS_ACTIVE,
	  source: ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
	});

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const recordAccount =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(registryAccount.recordCount.toNumber(), 1);
	assert.strictEqual(recordAccount.status, RECORD_STATUS_ACTIVE);
  });

  it("revokes an active eligibility record without changing record_count", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { eligibilityRecord } = await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	});

	await revokeEligibilityRecord({
	  registry,
	  eligibilityClass,
	  subjectKey,
	});

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const recordAccount =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(registryAccount.recordCount.toNumber(), 1);
	assert.strictEqual(recordAccount.status, RECORD_STATUS_REVOKED);
  });

  it("reactivates a revoked record only through authority upsert", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { eligibilityRecord } = await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	});

	await revokeEligibilityRecord({
	  registry,
	  eligibilityClass,
	  subjectKey,
	});

	await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	  status: RECORD_STATUS_ACTIVE,
	  source: ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
	});

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	const recordAccount =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(registryAccount.recordCount.toNumber(), 1);
	assert.strictEqual(recordAccount.status, RECORD_STATUS_ACTIVE);
  });

  it("allows record revocation after its class is disabled", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);

	const { eligibilityRecord } = await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	});

	await disableEligibilityClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	});

	await revokeEligibilityRecord({
	  registry,
	  eligibilityClass,
	  subjectKey,
	});

	const recordAccount =
	  await program.account.eligibilityRecord.fetch(eligibilityRecord);

	assert.strictEqual(recordAccount.status, RECORD_STATUS_REVOKED);
  });

  it("rejects record suspension from the wrong authority", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);
	const wrongAuthority = Keypair.generate();

	await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	});

	await expectRejects(
	  () =>
		suspendEligibilityRecord({
		  registry,
		  eligibilityClass,
		  subjectKey,
		  authority: wrongAuthority,
		}),
	  "wrong authority cannot suspend record",
	);
  });

  it("rejects record revocation from the wrong authority", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;
	const subjectKey = pubkeyBytes(wallet);
	const wrongAuthority = Keypair.generate();

	await upsertEligibilityRecord({
	  registry,
	  eligibilityClass,
	  wallet,
	  subjectKey,
	});

	await expectRejects(
	  () =>
		revokeEligibilityRecord({
		  registry,
		  eligibilityClass,
		  subjectKey,
		  authority: wrongAuthority,
		}),
	  "wrong authority cannot revoke record",
	);
  });

  it("rejects record upsert from the wrong authority", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wrongAuthority = Keypair.generate();
	const wallet = Keypair.generate().publicKey;

	await expectRejects(
	  () =>
		upsertEligibilityRecord({
		  registry,
		  eligibilityClass,
		  authority: wrongAuthority,
		  wallet,
		  subjectKey: pubkeyBytes(wallet),
		}),
	  "wrong authority cannot upsert record",
	);
  });

  it("rejects record upsert for a disabled class", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;

	await disableEligibilityClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	});

	await expectRejects(
	  () =>
		upsertEligibilityRecord({
		  registry,
		  eligibilityClass,
		  wallet,
		  subjectKey: pubkeyBytes(wallet),
		}),
	  "disabled class cannot receive record upsert",
	);
  });

  it("rejects invalid subject kind", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;

	await expectRejects(
	  () =>
		upsertEligibilityRecord({
		  registry,
		  eligibilityClass,
		  wallet,
		  subjectKind: 255,
		  subjectKey: pubkeyBytes(wallet),
		}),
	  "invalid subject kind rejected",
	);
  });

  it("rejects all-zero subject key", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	await expectRejects(
	  () =>
		upsertEligibilityRecord({
		  registry,
		  eligibilityClass,
		  wallet: PublicKey.default,
		  subjectKey: zeroBytes(SUBJECT_KEY_BYTES),
		}),
	  "all-zero subject key rejected",
	);
  });

  it("rejects wallet subject mismatch", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	const wallet = Keypair.generate().publicKey;
	const otherWallet = Keypair.generate().publicKey;

	await expectRejects(
	  () =>
		upsertEligibilityRecord({
		  registry,
		  eligibilityClass,
		  wallet,
		  subjectKey: pubkeyBytes(otherWallet),
		}),
	  "wallet subject mismatch rejected",
	);
  });

  it("rejects invalid record status", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;

	await expectRejects(
	  () =>
		upsertEligibilityRecord({
		  registry,
		  eligibilityClass,
		  wallet,
		  subjectKey: pubkeyBytes(wallet),
		  status: 255,
		}),
	  "invalid record status rejected",
	);
  });

  it("rejects invalid eligibility source", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;

	await expectRejects(
	  () =>
		upsertEligibilityRecord({
		  registry,
		  eligibilityClass,
		  wallet,
		  subjectKey: pubkeyBytes(wallet),
		  source: 255,
		}),
	  "invalid eligibility source rejected",
	);
  });

  it("rejects invalid record epoch window", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const { eligibilityClass } = await createPriveClass(registry);
	const wallet = Keypair.generate().publicKey;

	await expectRejects(
	  () =>
		upsertEligibilityRecord({
		  registry,
		  eligibilityClass,
		  wallet,
		  subjectKey: pubkeyBytes(wallet),
		  validFromEpochId: 202602,
		  validUntilEpochId: 202601,
		}),
	  "invalid record epoch window rejected",
	);
  });

  it("rejects class disable from the wrong authority", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const wrongAuthority = Keypair.generate();

	await createPriveClass(registry);

	await expectRejects(
	  () =>
		disableEligibilityClass({
		  registry,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  authority: wrongAuthority,
		}),
	  "wrong authority cannot disable class",
	);
  });

  it("rejects class upsert from the wrong authority", async () => {
	const { registry } = await initializeEligibilityRegistry();
	const wrongAuthority = Keypair.generate();

	await expectRejects(
	  () =>
		upsertEligibilityClass({
		  registry,
		  authority: wrongAuthority,
		}),
	  "wrong authority cannot upsert class",
	);
  });

  it("rejects invalid class_id", async () => {
	const { registry } = await initializeEligibilityRegistry();

	await expectRejects(
	  () =>
		upsertEligibilityClass({
		  registry,
		  classId: 0,
		}),
	  "class_id 0 rejected",
	);
  });

  it("rejects invalid class kind", async () => {
	const { registry } = await initializeEligibilityRegistry();

	await expectRejects(
	  () =>
		upsertEligibilityClass({
		  registry,
		  kind: 255,
		}),
	  "invalid class kind rejected",
	);
  });

  it("rejects invalid class status", async () => {
	const { registry } = await initializeEligibilityRegistry();

	await expectRejects(
	  () =>
		upsertEligibilityClass({
		  registry,
		  status: 255,
		}),
	  "invalid class status rejected",
	);
  });

  it("rejects invalid class epoch window", async () => {
	const { registry } = await initializeEligibilityRegistry();

	await expectRejects(
	  () =>
		upsertEligibilityClass({
		  registry,
		  validFromEpochId: 202602,
		  validUntilEpochId: 202601,
		}),
	  "invalid class epoch window rejected",
	);
  });
});
