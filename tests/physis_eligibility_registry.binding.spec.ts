import * as anchor from "@anchor-lang/core";
import { getEligibilityProgram } from "./helpers/eligibility-program.ts";
import {
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import assert from "assert";

import {
  ELIGIBILITY_PROGRAM_ID,
  GOVERNANCE_MODE_PRIVE_ONLY,
} from "./helpers/eligibility-constants.ts";

import {
  findCanonicalEpochRegistryPda,
  findEligibilityRegistryPda,
} from "./helpers/eligibility-pdas.ts";

import {
  initializeCanonicalEpochRegistry,
} from "./helpers/epoch-registry-fixture.ts";

describe(
  "physis_eligibility_registry Program 1 binding",
  () => {
	const provider =
	  anchor.AnchorProvider.env();

	anchor.setProvider(provider);

	const program =
	  getEligibilityProgram();

	assert.strictEqual(
	  program.programId.toBase58(),
	  ELIGIBILITY_PROGRAM_ID,
	);

	async function expectAnchorError(
	  promiseFactory:
		() => Promise<unknown>,
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
		  `Expected ${expectedCode}, received ${code}`,
		);

		return;
	  }

	  assert.fail(
		`Expected Anchor error ${expectedCode}`,
	  );
	}

	it(
	  "accepts an initialized canonical Program 1 Epoch Registry",
	  async () => {
		const realm =
		  Keypair.generate();

		const epochRegistry =
		  await initializeCanonicalEpochRegistry(
			realm.publicKey,
		  );

		const { pda: registry } =
		  findEligibilityRegistryPda(
			program.programId,
			realm.publicKey,
		  );

		await program.methods
		  .initializeRegistry(
			GOVERNANCE_MODE_PRIVE_ONLY,
		  )
		  .accountsStrict({
			payer:
			  provider.wallet.publicKey,
			authority:
			  provider.wallet.publicKey,
			realm: realm.publicKey,
			epochRegistry,
			registry,
			systemProgram:
			  SystemProgram.programId,
		  })
		  .rpc();

		const account =
		  await program.account
			.eligibilityRegistry
			.fetch(registry);

		assert.strictEqual(
		  account.epochRegistry.toBase58(),
		  epochRegistry.toBase58(),
		);
	  },
	);

	it(
	  "rejects a canonical PDA that has not been initialized by Program 1",
	  async () => {
		const realm =
		  Keypair.generate();

		const epochRegistry =
		  findCanonicalEpochRegistryPda(
			realm.publicKey,
		  );

		const { pda: registry } =
		  findEligibilityRegistryPda(
			program.programId,
			realm.publicKey,
		  );

		await expectAnchorError(
		  () =>
			program.methods
			  .initializeRegistry(
				GOVERNANCE_MODE_PRIVE_ONLY,
			  )
			  .accountsStrict({
				payer:
				  provider.wallet.publicKey,
				authority:
				  provider.wallet.publicKey,
				realm: realm.publicKey,
				epochRegistry,
				registry,
				systemProgram:
				  SystemProgram.programId,
			  })
			  .rpc(),
		  "EpochRegistryNotInitialized",
		);
	  },
	);

	it(
	  "rejects an arbitrary epoch registry address",
	  async () => {
		const realm =
		  Keypair.generate();

		const arbitraryEpochRegistry =
		  Keypair.generate().publicKey;

		const { pda: registry } =
		  findEligibilityRegistryPda(
			program.programId,
			realm.publicKey,
		  );

		await expectAnchorError(
		  () =>
			program.methods
			  .initializeRegistry(
				GOVERNANCE_MODE_PRIVE_ONLY,
			  )
			  .accountsStrict({
				payer:
				  provider.wallet.publicKey,
				authority:
				  provider.wallet.publicKey,
				realm: realm.publicKey,
				epochRegistry:
				  arbitraryEpochRegistry,
				registry,
				systemProgram:
				  SystemProgram.programId,
			  })
			  .rpc(),
		  "InvalidEpochRegistry",
		);
	  },
	);
  },
);
