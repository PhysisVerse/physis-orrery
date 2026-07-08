import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Keypair, SystemProgram } from "@solana/web3.js";
import assert from "assert";

import {
  ELIGIBILITY_PROGRAM_ID,
  ELIGIBILITY_REGISTRY_VERSION,
  GOVERNANCE_MODE_PRIVE_ONLY,
} from "./helpers/eligibility-constants.ts";

import { findEligibilityRegistryPda } from "./helpers/eligibility-pdas.ts";

describe("physis_eligibility_registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PhysisEligibilityRegistry as Program;

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

  function createFakeRealm(): Keypair {
	return Keypair.generate();
  }

  function createFakeEpochRegistry(): Keypair {
	return Keypair.generate();
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
	epochRegistry?: Keypair;
	governanceMode?: number;
  }) {
	const realm = params?.realm ?? createFakeRealm();
	const epochRegistry = params?.epochRegistry ?? createFakeEpochRegistry();

	const { pda: registry, bump } = findEligibilityRegistryPda(
	  program.programId,
	  realm.publicKey,
	);

	await program.methods
	  .initializeRegistry(params?.governanceMode ?? GOVERNANCE_MODE_PRIVE_ONLY)
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
	  realm,
	  epochRegistry,
	  registry,
	  bump,
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
	  epochRegistry.publicKey.toBase58(),
	);
	assert.strictEqual(account.governanceMode, GOVERNANCE_MODE_PRIVE_ONLY);
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

	assert.strictEqual(registry.toBase58(), expectedRegistry.toBase58());
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
	const epochRegistry = createFakeEpochRegistry();

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
});
