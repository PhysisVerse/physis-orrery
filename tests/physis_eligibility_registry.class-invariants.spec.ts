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
  CLASS_STATUS_DEPRECATED,
  CLASS_STATUS_DISABLED,
  CLASS_STATUS_DRAFT,
  ELIGIBILITY_PROGRAM_ID,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  NAME_BYTES,
} from "./helpers/eligibility-constants.ts";

import {
  findEligibilityClassPda,
  findEligibilityRegistryPda,
} from "./helpers/eligibility-pdas.ts";

import {
  initializeCanonicalEpochRegistry,
} from "./helpers/epoch-registry-fixture.ts";

const RESERVED_PHY_HOLDER_CLASS_ID = 10;
const RESERVED_PHY_HOLDER_CLASS_KIND = 10;

describe("physis_eligibility_registry class invariants", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

  function fixedBytes(value: string, length: number): number[] {
	const bytes = Buffer.alloc(length);
	bytes.write(value, "utf8");
	return Array.from(bytes);
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

  async function initializeRegistry(): Promise<PublicKey> {
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

	return registry;
  }

  async function upsertClass(params: {
	registry: PublicKey;
	classId: number;
	kind: number;
	status: number;
	enabled: boolean;
	name?: string;
	label?: string;
  }): Promise<PublicKey> {
	const { pda: eligibilityClass } = findEligibilityClassPda(
	  program.programId,
	  params.registry,
	  params.classId,
	);

	await program.methods
	  .upsertEligibilityClass(
		params.classId,
		fixedBytes(params.name ?? "TEST_CLASS", NAME_BYTES),
		fixedBytes(params.label ?? "TEST", LABEL_BYTES),
		params.kind,
		params.status,
		params.enabled,
		false,
		false,
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

  it("rejects PRIVE_MEMBER id paired with PERSONA_VERIFIED kind", async () => {
	const registry = await initializeRegistry();

	await expectRejects(
	  () =>
		upsertClass({
		  registry,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  kind: CLASS_KIND_PERSONA_VERIFIED,
		  status: CLASS_STATUS_ACTIVE,
		  enabled: true,
		}),
	  "PRIVE class id cannot use Persona class kind",
	);
  });

  it("rejects PERSONA_VERIFIED id paired with PRIVE_MEMBER kind", async () => {
	const registry = await initializeRegistry();

	await expectRejects(
	  () =>
		upsertClass({
		  registry,
		  classId: CLASS_ID_PERSONA_VERIFIED,
		  kind: CLASS_KIND_PRIVE_MEMBER,
		  status: CLASS_STATUS_ACTIVE,
		  enabled: true,
		}),
	  "Persona class id cannot use PRIVE class kind",
	);
  });

  it("rejects reserved future classes in v1", async () => {
	const registry = await initializeRegistry();

	await expectRejects(
	  () =>
		upsertClass({
		  registry,
		  classId: RESERVED_PHY_HOLDER_CLASS_ID,
		  kind: RESERVED_PHY_HOLDER_CLASS_KIND,
		  status: CLASS_STATUS_ACTIVE,
		  enabled: true,
		}),
	  "reserved PHY holder class cannot become live in v1",
	);
  });

  it("rejects an Active class with enabled set to false", async () => {
	const registry = await initializeRegistry();

	await expectRejects(
	  () =>
		upsertClass({
		  registry,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  kind: CLASS_KIND_PRIVE_MEMBER,
		  status: CLASS_STATUS_ACTIVE,
		  enabled: false,
		}),
	  "active class must be enabled",
	);
  });

  it("rejects a Draft class with enabled set to true", async () => {
	const registry = await initializeRegistry();

	await expectRejects(
	  () =>
		upsertClass({
		  registry,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  kind: CLASS_KIND_PRIVE_MEMBER,
		  status: CLASS_STATUS_DRAFT,
		  enabled: true,
		}),
	  "draft class cannot be enabled",
	);
  });

  it("rejects a Disabled class with enabled set to true", async () => {
	const registry = await initializeRegistry();

	await expectRejects(
	  () =>
		upsertClass({
		  registry,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  kind: CLASS_KIND_PRIVE_MEMBER,
		  status: CLASS_STATUS_DISABLED,
		  enabled: true,
		}),
	  "disabled class cannot be enabled",
	);
  });

  it("rejects a Deprecated class with enabled set to true", async () => {
	const registry = await initializeRegistry();

	await expectRejects(
	  () =>
		upsertClass({
		  registry,
		  classId: CLASS_ID_PRIVE_MEMBER,
		  kind: CLASS_KIND_PRIVE_MEMBER,
		  status: CLASS_STATUS_DEPRECATED,
		  enabled: true,
		}),
	  "deprecated class cannot be enabled",
	);
  });

  it("accepts valid disabled states without incrementing class_count", async () => {
	const registry = await initializeRegistry();

	const eligibilityClass = await upsertClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  kind: CLASS_KIND_PRIVE_MEMBER,
	  status: CLASS_STATUS_DRAFT,
	  enabled: false,
	  name: "PRIVE_MEMBER",
	  label: "PRIVE",
	});

	let classAccount =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	assert.strictEqual(classAccount.status, CLASS_STATUS_DRAFT);
	assert.strictEqual(classAccount.enabled, false);

	await upsertClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  kind: CLASS_KIND_PRIVE_MEMBER,
	  status: CLASS_STATUS_DISABLED,
	  enabled: false,
	  name: "PRIVE_MEMBER",
	  label: "PRIVE",
	});

	classAccount =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	assert.strictEqual(classAccount.status, CLASS_STATUS_DISABLED);
	assert.strictEqual(classAccount.enabled, false);

	await upsertClass({
	  registry,
	  classId: CLASS_ID_PRIVE_MEMBER,
	  kind: CLASS_KIND_PRIVE_MEMBER,
	  status: CLASS_STATUS_DEPRECATED,
	  enabled: false,
	  name: "PRIVE_MEMBER",
	  label: "PRIVE",
	});

	classAccount =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	const registryAccount =
	  await program.account.eligibilityRegistry.fetch(registry);

	assert.strictEqual(classAccount.status, CLASS_STATUS_DEPRECATED);
	assert.strictEqual(classAccount.enabled, false);
	assert.strictEqual(registryAccount.classCount, 1);
  });
});
