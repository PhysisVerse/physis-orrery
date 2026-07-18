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

type ParsedEvent = {
  name: string;
  data: Record<string, unknown>;
};

describe("physis_eligibility_registry events", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

  function fixedBytes(value: string, length: number): number[] {
	const bytes = Buffer.alloc(length);
	bytes.write(value, "utf8");
	return Array.from(bytes);
  }

  function pubkeyBytes(pubkey: PublicKey): number[] {
	return Array.from(pubkey.toBytes());
  }

  function asPublicKey(value: unknown): PublicKey {
	assert.ok(
	  value instanceof PublicKey,
	  "Expected decoded event field to be a PublicKey",
	);

	return value;
  }

  function asBn(value: unknown): anchor.BN {
	assert.ok(
	  anchor.BN.isBN(value),
	  "Expected decoded event field to be an Anchor BN",
	);

	return value as anchor.BN;
  }

  function eventField<T>(
	data: Record<string, unknown>,
	camelCaseName: string,
	snakeCaseName?: string,
  ): T {
	if (camelCaseName in data) {
	  return data[camelCaseName] as T;
	}

	if (snakeCaseName && snakeCaseName in data) {
	  return data[snakeCaseName] as T;
	}

	assert.fail(`Missing event field: ${camelCaseName}`);
  }

  async function loadEvents(signature: string): Promise<ParsedEvent[]> {
	let logs: string[] | null = null;

	for (let attempt = 0; attempt < 10; attempt += 1) {
	  const transaction = await provider.connection.getTransaction(signature, {
		commitment: "confirmed",
		maxSupportedTransactionVersion: 0,
	  });

	  logs = transaction?.meta?.logMessages ?? null;

	  if (logs) {
		break;
	  }

	  await new Promise((resolve) => setTimeout(resolve, 50));
	}

	assert.notStrictEqual(
	  logs,
	  null,
	  `Transaction logs were unavailable for ${signature}`,
	);

	const parser = new anchor.EventParser(program.programId, program.coder);

	return Array.from(parser.parseLogs(logs!)).map((event) => ({
	  name: event.name,
	  data: event.data as Record<string, unknown>,
	}));
  }

  async function expectEvent(
	signature: string,
	expectedName: string,
  ): Promise<Record<string, unknown>> {
	const events = await loadEvents(signature);

	const event = events.find(
	  (candidate) =>
		candidate.name.toLowerCase() === expectedName.toLowerCase(),
	);

	assert.ok(
	  event,
	  `Expected ${expectedName}; decoded events: ${events
		.map((candidate) => candidate.name)
		.join(", ")}`,
	);

	return event.data;
  }

  async function initializeRegistry() {
	const realm = Keypair.generate();
	const epochRegistry = await initializeCanonicalEpochRegistry(realm.publicKey);

	const { pda: registry } = findEligibilityRegistryPda(
	  program.programId,
	  realm.publicKey,
	);

	const signature = await program.methods
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
	  signature,
	  realm,
	  epochRegistry,
	  registry,
	};
  }

  async function createPriveClass(registry: PublicKey) {
	const { pda: eligibilityClass } = findEligibilityClassPda(
	  program.programId,
	  registry,
	  CLASS_ID_PRIVE_MEMBER,
	);

	const signature = await program.methods
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
	  signature,
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

	const signature = await program.methods
	  .upsertEligibilityRecordByAuthority(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
		wallet,
		RECORD_STATUS_ACTIVE,
		ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		fixedBytes("root-evidence", METADATA_HASH_BYTES),
		0,
		0,
		new anchor.BN(0),
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
	  signature,
	  wallet,
	  subjectKey,
	  eligibilityRecord,
	};
  }

  it("emits EligibilityRegistryInitialized", async () => {
	const {
	  signature,
	  realm,
	  epochRegistry,
	  registry,
	} = await initializeRegistry();

	const data = await expectEvent(
	  signature,
	  "EligibilityRegistryInitialized",
	);

	assert.strictEqual(
	  asPublicKey(eventField(data, "registry")).toBase58(),
	  registry.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(eventField(data, "realm")).toBase58(),
	  realm.publicKey.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(eventField(data, "authority")).toBase58(),
	  provider.wallet.publicKey.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(
		eventField(data, "epochRegistry", "epoch_registry"),
	  ).toBase58(),
	  epochRegistry.toBase58(),
	);
	assert.strictEqual(
	  eventField<number>(data, "governanceMode", "governance_mode"),
	  GOVERNANCE_MODE_PRIVE_ONLY,
	);
	assert.ok(asBn(eventField(data, "timestamp")).toNumber() > 0);
	assert.ok(asBn(eventField(data, "slot")).toNumber() > 0);
	assert.ok(
	  asBn(eventField(data, "solanaEpoch", "solana_epoch")).toNumber() >= 0,
	);
  });

  it("emits EligibilityClassUpserted", async () => {
	const { registry } = await initializeRegistry();
	const { signature, eligibilityClass } =
	  await createPriveClass(registry);

	const data = await expectEvent(signature, "EligibilityClassUpserted");

	assert.strictEqual(
	  asPublicKey(eventField(data, "registry")).toBase58(),
	  registry.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(
		eventField(data, "eligibilityClass", "eligibility_class"),
	  ).toBase58(),
	  eligibilityClass.toBase58(),
	);
	assert.strictEqual(
	  eventField<number>(data, "classId", "class_id"),
	  CLASS_ID_PRIVE_MEMBER,
	);
	assert.strictEqual(
	  eventField<number>(data, "kind"),
	  CLASS_KIND_PRIVE_MEMBER,
	);
	assert.strictEqual(
	  eventField<number>(data, "status"),
	  CLASS_STATUS_ACTIVE,
	);
	assert.strictEqual(eventField<boolean>(data, "enabled"), true);
	assert.strictEqual(
	  eventField<boolean>(
		data,
		"governanceEligible",
		"governance_eligible",
	  ),
	  true,
	);
	assert.strictEqual(
	  eventField<boolean>(data, "rewardsEligible", "rewards_eligible"),
	  true,
	);
  });

  it("emits EligibilityClassDisabled", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	const signature = await program.methods
	  .disableEligibilityClass(CLASS_ID_PRIVE_MEMBER)
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
	  })
	  .rpc();

	const data = await expectEvent(signature, "EligibilityClassDisabled");

	assert.strictEqual(
	  asPublicKey(eventField(data, "registry")).toBase58(),
	  registry.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(
		eventField(data, "eligibilityClass", "eligibility_class"),
	  ).toBase58(),
	  eligibilityClass.toBase58(),
	);
	assert.strictEqual(
	  eventField<number>(data, "classId", "class_id"),
	  CLASS_ID_PRIVE_MEMBER,
	);
  });

  it("emits EligibilityRecordUpserted", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	const {
	  signature,
	  wallet,
	  subjectKey,
	  eligibilityRecord,
	} = await createPriveRecord(registry, eligibilityClass);

	const data = await expectEvent(signature, "EligibilityRecordUpserted");

	assert.strictEqual(
	  asPublicKey(eventField(data, "registry")).toBase58(),
	  registry.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(
		eventField(data, "eligibilityClass", "eligibility_class"),
	  ).toBase58(),
	  eligibilityClass.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(
		eventField(data, "eligibilityRecord", "eligibility_record"),
	  ).toBase58(),
	  eligibilityRecord.toBase58(),
	);
	assert.strictEqual(
	  eventField<number>(data, "classId", "class_id"),
	  CLASS_ID_PRIVE_MEMBER,
	);
	assert.strictEqual(
	  eventField<number>(data, "subjectKind", "subject_kind"),
	  SUBJECT_KIND_WALLET,
	);
	assert.deepStrictEqual(
	  Array.from(
		eventField<number[] | Uint8Array>(
		  data,
		  "subjectKey",
		  "subject_key",
		),
	  ),
	  subjectKey,
	);
	assert.strictEqual(
	  asPublicKey(eventField(data, "wallet")).toBase58(),
	  wallet.toBase58(),
	);
	assert.strictEqual(
	  eventField<number>(data, "status"),
	  RECORD_STATUS_ACTIVE,
	);
	assert.strictEqual(
	  eventField<number>(data, "source"),
	  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
	);
	assert.strictEqual(
	  eventField<number>(data, "validFromEpochId", "valid_from_epoch_id"),
	  0,
	);
	assert.strictEqual(
	  eventField<number>(data, "validUntilEpochId", "valid_until_epoch_id"),
	  0,
	);
  });

  it("emits EligibilityRecordSuspended", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	const { subjectKey, eligibilityRecord } =
	  await createPriveRecord(registry, eligibilityClass);

	const signature = await program.methods
	  .suspendEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		eligibilityRecord,
	  })
	  .rpc();

	const data = await expectEvent(signature, "EligibilityRecordSuspended");

	assert.strictEqual(
	  asPublicKey(
		eventField(data, "eligibilityRecord", "eligibility_record"),
	  ).toBase58(),
	  eligibilityRecord.toBase58(),
	);
	assert.strictEqual(
	  eventField<number>(data, "classId", "class_id"),
	  CLASS_ID_PRIVE_MEMBER,
	);
	assert.deepStrictEqual(
	  Array.from(
		eventField<number[] | Uint8Array>(
		  data,
		  "subjectKey",
		  "subject_key",
		),
	  ),
	  subjectKey,
	);
  });

  it("emits EligibilityRecordRevoked", async () => {
	const { registry } = await initializeRegistry();
	const { eligibilityClass } = await createPriveClass(registry);

	const { subjectKey, eligibilityRecord } =
	  await createPriveRecord(registry, eligibilityClass);

	const signature = await program.methods
	  .revokeEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		eligibilityRecord,
	  })
	  .rpc();

	const data = await expectEvent(signature, "EligibilityRecordRevoked");

	assert.strictEqual(
	  asPublicKey(
		eventField(data, "eligibilityRecord", "eligibility_record"),
	  ).toBase58(),
	  eligibilityRecord.toBase58(),
	);
	assert.strictEqual(
	  eventField<number>(data, "classId", "class_id"),
	  CLASS_ID_PRIVE_MEMBER,
	);
	assert.deepStrictEqual(
	  Array.from(
		eventField<number[] | Uint8Array>(
		  data,
		  "subjectKey",
		  "subject_key",
		),
	  ),
	  subjectKey,
	);
  });

  it("emits EligibilityRegistryPaused", async () => {
	const { registry } = await initializeRegistry();

	const signature = await program.methods
	  .pauseRegistry()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	const data = await expectEvent(signature, "EligibilityRegistryPaused");

	assert.strictEqual(
	  asPublicKey(eventField(data, "registry")).toBase58(),
	  registry.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(eventField(data, "authority")).toBase58(),
	  provider.wallet.publicKey.toBase58(),
	);
  });

  it("emits EligibilityRegistryResumed", async () => {
	const { registry } = await initializeRegistry();

	await program.methods
	  .pauseRegistry()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	const signature = await program.methods
	  .resumeRegistry()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	const data = await expectEvent(signature, "EligibilityRegistryResumed");

	assert.strictEqual(
	  asPublicKey(eventField(data, "registry")).toBase58(),
	  registry.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(eventField(data, "authority")).toBase58(),
	  provider.wallet.publicKey.toBase58(),
	);
  });

  it("emits EligibilityRegistryAuthorityTransferred", async () => {
	const { registry } = await initializeRegistry();
	const newAuthority = Keypair.generate();

	const signature = await program.methods
	  .transferRegistryAuthority(newAuthority.publicKey)
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	const data = await expectEvent(
	  signature,
	  "EligibilityRegistryAuthorityTransferred",
	);

	assert.strictEqual(
	  asPublicKey(eventField(data, "registry")).toBase58(),
	  registry.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(
		eventField(data, "oldAuthority", "old_authority"),
	  ).toBase58(),
	  provider.wallet.publicKey.toBase58(),
	);
	assert.strictEqual(
	  asPublicKey(
		eventField(data, "newAuthority", "new_authority"),
	  ).toBase58(),
	  newAuthority.publicKey.toBase58(),
	);
  });
});
