import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import {
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import assert from "assert";

import {
  ASTRALIS_EPOCH_DURATION_SECONDS,
  ASTRALIS_EPOCH_ZERO_TS,
  EPOCH_STATUS_PENDING,
  PHYSIS_YEAR_START_DAY,
  PHYSIS_YEAR_START_MONTH,
  PROGRAM_ID,
} from "./helpers/constants.ts";

import { findEpochPda, findRegistryPda } from "./helpers/pdas.ts";
import { labelBytes, nowUnixSeconds } from "./helpers/time.ts";

describe("physis_epoch_registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PhysisEpochRegistry as Program;

  assert.strictEqual(program.programId.toBase58(), PROGRAM_ID);

  function createFakeRealm(): Keypair {
	return Keypair.generate();
  }

  async function initializeRegistry() {
	const realm = createFakeRealm();
	const registry = findRegistryPda(program.programId, realm.publicKey);

	await program.methods
	  .initializeRegistry(
		PHYSIS_YEAR_START_MONTH,
		PHYSIS_YEAR_START_DAY,
		new anchor.BN(ASTRALIS_EPOCH_ZERO_TS),
		new anchor.BN(ASTRALIS_EPOCH_DURATION_SECONDS),
	  )
	  .accounts({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		realm: realm.publicKey,
		registry,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	return {
	  realm,
	  registry,
	};
  }

  it("initializes the registry", async () => {
	const { realm, registry } = await initializeRegistry();

	const account = await program.account.epochRegistry.fetch(registry);

	assert.strictEqual(account.version, 1);
	assert.strictEqual(account.authority.toBase58(), provider.wallet.publicKey.toBase58());
	assert.strictEqual(account.realm.toBase58(), realm.publicKey.toBase58());
	assert.strictEqual(account.physisYearStartMonth, PHYSIS_YEAR_START_MONTH);
	assert.strictEqual(account.physisYearStartDay, PHYSIS_YEAR_START_DAY);
	assert.strictEqual(account.astralisEpochZeroTs.toNumber(), ASTRALIS_EPOCH_ZERO_TS);
	assert.strictEqual(
	  account.astralisEpochDurationSeconds.toNumber(),
	  ASTRALIS_EPOCH_DURATION_SECONDS,
	);
	assert.strictEqual(account.paused, false);
	assert.strictEqual(account.currentEpoch, null);
	assert.strictEqual(account.latestClosedEpoch, null);
  });

  it("registers a valid Physis epoch", async () => {
	const { registry } = await initializeRegistry();

	const epochId = 202602;
	const epoch = findEpochPda(program.programId, registry, epochId);

	const startTs = nowUnixSeconds() - 60;
	const endTs = nowUnixSeconds() + 3600;

	await program.methods
	  .registerEpoch(
		epochId,
		2026,
		3,
		2026,
		2,
		labelBytes("Q2"),
		new anchor.BN(startTs),
		new anchor.BN(endTs),
	  )
	  .accounts({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		registry,
		epoch,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	const epochAccount = await program.account.physisEpoch.fetch(epoch);

	assert.strictEqual(epochAccount.version, 1);
	assert.strictEqual(epochAccount.registry.toBase58(), registry.toBase58());
	assert.strictEqual(epochAccount.epochId, epochId);
	assert.strictEqual(epochAccount.calendarYear, 2026);
	assert.strictEqual(epochAccount.calendarQuarter, 3);
	assert.strictEqual(epochAccount.physisYear, 2026);
	assert.strictEqual(epochAccount.physisQuarter, 2);
	assert.strictEqual(epochAccount.startTs.toNumber(), startTs);
	assert.strictEqual(epochAccount.endTs.toNumber(), endTs);
	assert.strictEqual(epochAccount.status, EPOCH_STATUS_PENDING);
  });

  it("pauses and resumes the registry", async () => {
	const { registry } = await initializeRegistry();

	await program.methods
	  .pauseRegistry()
	  .accounts({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	let account = await program.account.epochRegistry.fetch(registry);
	assert.strictEqual(account.paused, true);

	await program.methods
	  .resumeRegistry()
	  .accounts({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	account = await program.account.epochRegistry.fetch(registry);
	assert.strictEqual(account.paused, false);
  });
});
