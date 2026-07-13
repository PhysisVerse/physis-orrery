import * as anchor from "@anchor-lang/core";
import { getEligibilityProgram } from "./helpers/eligibility-program.ts";
import { Keypair, SystemProgram } from "@solana/web3.js";
import assert from "assert";

import {
  ELIGIBILITY_PROGRAM_ID,
  GOVERNANCE_MODE_PRIVE_ONLY,
} from "./helpers/eligibility-constants.ts";

import {
  findCanonicalEpochRegistryPda,
  findEligibilityRegistryPda,
} from "./helpers/eligibility-pdas.ts";

describe("physis_eligibility_registry Program 1 binding", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

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

  it("accepts the canonical Program 1 epoch registry PDA", async () => {
	const realm = Keypair.generate();

	const epochRegistry =
	  findCanonicalEpochRegistryPda(realm.publicKey);

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

	const account =
	  await program.account.eligibilityRegistry.fetch(registry);

	assert.strictEqual(
	  account.epochRegistry.toBase58(),
	  epochRegistry.toBase58(),
	);
  });

  it("rejects an arbitrary epoch registry address", async () => {
	const realm = Keypair.generate();
	const arbitraryEpochRegistry = Keypair.generate().publicKey;

	const { pda: registry } = findEligibilityRegistryPda(
	  program.programId,
	  realm.publicKey,
	);

	await expectRejects(
	  () =>
		program.methods
		  .initializeRegistry(GOVERNANCE_MODE_PRIVE_ONLY)
		  .accountsStrict({
			payer: provider.wallet.publicKey,
			authority: provider.wallet.publicKey,
			realm: realm.publicKey,
			epochRegistry: arbitraryEpochRegistry,
			registry,
			systemProgram: SystemProgram.programId,
		  })
		  .rpc(),
	  "arbitrary epoch registry must be rejected",
	);
  });
});
