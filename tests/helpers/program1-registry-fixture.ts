import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import {
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

import type {
  PhysisEpochRegistry,
} from "../../packages/idl-types/physis_epoch_registry.ts";

import {
  ASTRALIS_EPOCH_DURATION_SECONDS,
  ASTRALIS_EPOCH_ZERO_TS,
  PHYSIS_YEAR_START_DAY,
  PHYSIS_YEAR_START_MONTH,
  PROGRAM_ID,
} from "./constants.ts";

import {
  findCanonicalEpochRegistryPda,
} from "./eligibility-pdas.ts";

export async function initializeCanonicalEpochRegistry(
  realm: PublicKey,
): Promise<PublicKey> {
  const provider =
	anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  const program =
	anchor.workspace
	  .PhysisEpochRegistry as
	  Program<PhysisEpochRegistry>;

  if (
	program.programId.toBase58() !==
	PROGRAM_ID
  ) {
	throw new Error(
	  [
		"Program 1 ID mismatch.",
		`Expected: ${PROGRAM_ID}`,
		`Actual:   ${program.programId.toBase58()}`,
	  ].join("\n"),
	);
  }

  const registry =
	findCanonicalEpochRegistryPda(
	  realm,
	);

  const existing =
	await provider.connection
	  .getAccountInfo(registry);

  if (existing !== null) {
	if (
	  !existing.owner.equals(
		program.programId,
	  )
	) {
	  throw new Error(
		`Existing Program 1 registry has the wrong owner: ${registry.toBase58()}`,
	  );
	}

	return registry;
  }

  await program.methods
	.initializeRegistry(
	  PHYSIS_YEAR_START_MONTH,
	  PHYSIS_YEAR_START_DAY,
	  new anchor.BN(
		ASTRALIS_EPOCH_ZERO_TS,
	  ),
	  new anchor.BN(
		ASTRALIS_EPOCH_DURATION_SECONDS,
	  ),
	)
	.accountsStrict({
	  payer:
		provider.wallet.publicKey,
	  authority:
		provider.wallet.publicKey,
	  realm,
	  registry,
	  systemProgram:
		SystemProgram.programId,
	})
	.rpc();

  return registry;
}
