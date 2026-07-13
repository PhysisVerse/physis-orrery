import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import assert from "assert";

import {
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_PROGRAM_ID,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  NAME_BYTES,
} from "./helpers/eligibility-constants.ts";

import {
  findEligibilityClassPda,
  findEligibilityRegistryPda,
} from "./helpers/eligibility-pdas.ts";

describe("physis_eligibility_registry authority transfer", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PhysisEligibilityRegistry as Program;

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

  async function initializeRegistry() {
	const realm = Keypair.generate();
	const epochRegistry = Keypair.generate();

	const { pda: registry } = findEligibilityRegistryPda(
	  program.programId,
	  realm.publicKey,
	);

	await program.methods
	  .initializeRegistry(GOVERNANCE_MODE_PRIVE_ONLY)
	  .accounts({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		realm: realm.publicKey,
		epochRegistry: epochRegistry.publicKey,
		registry,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	return {
	  registry,
	};
  }

  async function transferAuthority(params: {
	registry: PublicKey;
	newAuthority: PublicKey;
	currentAuthority?: Keypair;
  }): Promise<void> {
	const builder = program.methods
	  .transferRegistryAuthority(params.newAuthority)
	  .accounts({
		authority:
		  params.currentAuthority?.publicKey ?? provider.wallet.publicKey,
		registry: params.registry,
	  });

	if (params.currentAuthority) {
	  await builder.signers([params.currentAuthority]).rpc();
	} else {
	  await builder.rpc();
	}
  }

  async function createPriveClass(params: {
	registry: PublicKey;
	authority?: Keypair;
  }): Promise<PublicKey> {
	const { pda: eligibilityClass } = findEligibilityClassPda(
	  program.programId,
	  params.registry,
	  CLASS_ID_PRIVE_MEMBER,
	);

	const builder = program.methods
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
	  .accounts({
		payer: provider.wallet.publicKey,
		authority: params.authority?.publicKey ?? provider.wallet.publicKey,
		registry: params.registry,
		eligibilityClass,
		systemProgram: SystemProgram.programId,
	  });

	if (params.authority) {
	  await builder.signers([params.authority]).rpc();
	} else {
	  await builder.rpc();
	}

	return eligibilityClass;
  }

  async function pauseRegistry(registry: PublicKey): Promise<void> {
	await program.methods
	  .pauseRegistry()
	  .accounts({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();
  }

  it("transfers registry authority", async () => {
	const { registry } = await initializeRegistry();
	const newAuthority = Keypair.generate();

	const before =
	  await program.account.eligibilityRegistry.fetch(registry);

	await transferAuthority({
	  registry,
	  newAuthority: newAuthority.publicKey,
	});

	const after =
	  await program.account.eligibilityRegistry.fetch(registry);

	assert.strictEqual(
	  before.authority.toBase58(),
	  provider.wallet.publicKey.toBase58(),
	);
	assert.strictEqual(
	  after.authority.toBase58(),
	  newAuthority.publicKey.toBase58(),
	);
	assert.ok(after.updatedSlot.toNumber() >= before.updatedSlot.toNumber());
  });

  it("rejects authority transfer from the wrong authority", async () => {
	const { registry } = await initializeRegistry();
	const wrongAuthority = Keypair.generate();
	const newAuthority = Keypair.generate();

	await expectRejects(
	  () =>
		transferAuthority({
		  registry,
		  currentAuthority: wrongAuthority,
		  newAuthority: newAuthority.publicKey,
		}),
	  "wrong authority cannot transfer registry authority",
	);
  });

  it("rejects the default pubkey as new authority", async () => {
	const { registry } = await initializeRegistry();

	await expectRejects(
	  () =>
		transferAuthority({
		  registry,
		  newAuthority: PublicKey.default,
		}),
	  "default pubkey cannot become registry authority",
	);
  });

  it("removes mutation authority from the old authority", async () => {
	const { registry } = await initializeRegistry();
	const newAuthority = Keypair.generate();

	await transferAuthority({
	  registry,
	  newAuthority: newAuthority.publicKey,
	});

	await expectRejects(
	  () =>
		createPriveClass({
		  registry,
		}),
	  "old authority cannot mutate registry after transfer",
	);
  });

  it("grants mutation authority to the new authority", async () => {
	const { registry } = await initializeRegistry();
	const newAuthority = Keypair.generate();

	await transferAuthority({
	  registry,
	  newAuthority: newAuthority.publicKey,
	});

	const eligibilityClass = await createPriveClass({
	  registry,
	  authority: newAuthority,
	});

	const classAccount =
	  await program.account.eligibilityClass.fetch(eligibilityClass);

	assert.strictEqual(classAccount.classId, CLASS_ID_PRIVE_MEMBER);
	assert.strictEqual(classAccount.status, CLASS_STATUS_ACTIVE);
  });

  it("allows authority recovery while the registry is paused", async () => {
	const { registry } = await initializeRegistry();
	const newAuthority = Keypair.generate();

	await pauseRegistry(registry);

	await transferAuthority({
	  registry,
	  newAuthority: newAuthority.publicKey,
	});

	let account =
	  await program.account.eligibilityRegistry.fetch(registry);

	assert.strictEqual(account.paused, true);
	assert.strictEqual(
	  account.authority.toBase58(),
	  newAuthority.publicKey.toBase58(),
	);

	await program.methods
	  .resumeRegistry()
	  .accounts({
		authority: newAuthority.publicKey,
		registry,
	  })
	  .signers([newAuthority])
	  .rpc();

	account = await program.account.eligibilityRegistry.fetch(registry);

	assert.strictEqual(account.paused, false);
  });
});
