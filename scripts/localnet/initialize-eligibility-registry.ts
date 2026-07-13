import * as anchor from "@anchor-lang/core";
import { SystemProgram } from "@solana/web3.js";

import {
  GOVERNANCE_MODE_PRIVE_ONLY,
  accountExists,
  assertProgramId,
  findEligibilityRegistryPda,
  findEpochRegistryPda,
  getEligibilityProgram,
  loadEligibilityConfig,
  requireOwnedAccount,
} from "../shared/eligibility.ts";

async function main(): Promise<void> {
  const config = loadEligibilityConfig("localnet");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assertProgramId(
	program.programId,
	config.eligibilityProgramId,
  );

  const epochRegistry = findEpochRegistryPda(
	config.epochProgramId,
	config.realm,
  );

  const registry = findEligibilityRegistryPda(
	program.programId,
	config.realm,
  );

  console.log(
	"Orrery: initialize Physis Eligibility Registry",
  );
  console.log("Cluster:", config.cluster);
  console.log(
	"Program 2:",
	program.programId.toBase58(),
  );
  console.log(
	"Program 1:",
	config.epochProgramId.toBase58(),
  );
  console.log("Realm:", config.realm.toBase58());
  console.log(
	"Epoch registry:",
	epochRegistry.toBase58(),
  );
  console.log(
	"Eligibility registry:",
	registry.toBase58(),
  );
  console.log(
	"Transaction authority:",
	provider.wallet.publicKey.toBase58(),
  );

  await requireOwnedAccount(
	provider.connection,
	epochRegistry,
	config.epochProgramId,
	"Canonical Program 1 epoch registry",
  );

  const exists = await accountExists(
	provider.connection,
	registry,
  );

  if (exists) {
	await requireOwnedAccount(
	  provider.connection,
	  registry,
	  program.programId,
	  "Program 2 eligibility registry",
	);

	const existing =
	  await program.account.eligibilityRegistry.fetch(
		registry,
	  );

	if (!existing.realm.equals(config.realm)) {
	  throw new Error(
		"Existing eligibility registry Realm mismatch",
	  );
	}

	if (
	  !existing.epochRegistry.equals(epochRegistry)
	) {
	  throw new Error(
		"Existing eligibility registry Program 1 binding mismatch",
	  );
	}

	if (
	  existing.governanceMode !==
	  GOVERNANCE_MODE_PRIVE_ONLY
	) {
	  throw new Error(
		"Existing eligibility registry governance mode mismatch",
	  );
	}

	console.log(
	  "Eligibility registry already initialized.",
	);
	console.log(
	  "Authority:",
	  existing.authority.toBase58(),
	);
	console.log("Paused:", existing.paused);
	console.log(
	  "Class count:",
	  existing.classCount,
	);
	console.log(
	  "Record count:",
	  existing.recordCount.toString(),
	);

	return;
  }

  const signature = await program.methods
	.initializeRegistry(
	  GOVERNANCE_MODE_PRIVE_ONLY,
	)
	.accountsStrict({
	  payer: provider.wallet.publicKey,
	  authority: provider.wallet.publicKey,
	  realm: config.realm,
	  epochRegistry,
	  registry,
	  systemProgram: SystemProgram.programId,
	})
	.rpc();

  const created =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  if (!created.realm.equals(config.realm)) {
	throw new Error(
	  "Created registry Realm verification failed",
	);
  }

  if (
	!created.epochRegistry.equals(epochRegistry)
  ) {
	throw new Error(
	  "Created registry Program 1 binding verification failed",
	);
  }

  console.log(
	"Eligibility registry initialized and verified.",
  );
  console.log("Signature:", signature);
  console.log(
	"Authority:",
	created.authority.toBase58(),
  );
}

main().catch((error: unknown) => {
  console.error(
	error instanceof Error
	  ? error.message
	  : error,
  );

  process.exit(1);
});
