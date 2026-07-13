import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import type { PhysisEpochRegistry } from "../packages/idl-types/physis_epoch_registry.ts";
import {
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import assert from "assert";

import {
  ASTRALIS_EPOCH_DURATION_SECONDS,
  ASTRALIS_EPOCH_ZERO_TS,
  EPOCH_STATUS_ACTIVE,
  EPOCH_STATUS_CLOSED,
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

  const program =
  anchor.workspace.PhysisEpochRegistry as Program<PhysisEpochRegistry>;

  assert.strictEqual(program.programId.toBase58(), PROGRAM_ID);

  function createFakeRealm(): Keypair {
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
	  .accountsStrict({
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

  async function registerEpoch(params?: {
	registry?: anchor.web3.PublicKey;
	epochId?: number;
	calendarYear?: number;
	calendarQuarter?: number;
	physisYear?: number;
	physisQuarter?: number;
	label?: string;
	startTs?: number;
	endTs?: number;
	authority?: Keypair;
  }) {
	const registry = params?.registry ?? (await initializeRegistry()).registry;

	const epochId = params?.epochId ?? 202602;
	const calendarYear = params?.calendarYear ?? 2026;
	const calendarQuarter = params?.calendarQuarter ?? 3;
	const physisYear = params?.physisYear ?? 2026;
	const physisQuarter = params?.physisQuarter ?? 2;
	const label = params?.label ?? "Q2";

	const startTs = params?.startTs ?? nowUnixSeconds() - 60;
	const endTs = params?.endTs ?? nowUnixSeconds() + 3600;

	const epoch = findEpochPda(program.programId, registry, epochId);

	const builder = program.methods
	  .registerEpoch(
		epochId,
		calendarYear,
		calendarQuarter,
		physisYear,
		physisQuarter,
		labelBytes(label),
		new anchor.BN(startTs),
		new anchor.BN(endTs),
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: params?.authority?.publicKey ?? provider.wallet.publicKey,
		registry,
		epoch,
		systemProgram: SystemProgram.programId,
	  });

	if (params?.authority) {
	  await builder.signers([params.authority]).rpc();
	} else {
	  await builder.rpc();
	}

	return {
	  registry,
	  epoch,
	  epochId,
	  startTs,
	  endTs,
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
	  .accountsStrict({
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
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	let account = await program.account.epochRegistry.fetch(registry);
	assert.strictEqual(account.paused, true);

	await program.methods
	  .resumeRegistry()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	account = await program.account.epochRegistry.fetch(registry);
	assert.strictEqual(account.paused, false);
  });

  it("activates an epoch after its start time", async () => {
	const { registry } = await initializeRegistry();

	const { epoch } = await registerEpoch({
	  registry,
	  startTs: nowUnixSeconds() - 120,
	  endTs: nowUnixSeconds() + 3600,
	});

	await program.methods
	  .activateEpoch()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		epoch,
	  })
	  .rpc();

	const registryAccount = await program.account.epochRegistry.fetch(registry);
	const epochAccount = await program.account.physisEpoch.fetch(epoch);

	assert.strictEqual(epochAccount.status, EPOCH_STATUS_ACTIVE);
	assert.strictEqual(registryAccount.currentEpoch!.toBase58(), epoch.toBase58());
	assert.ok(epochAccount.activatedAtTs.toNumber() > 0);
	assert.ok(epochAccount.activatedAtSlot.toNumber() > 0);
	assert.ok(epochAccount.activatedAtSolanaEpoch.toNumber() >= 0);
  });

  it("closes an active epoch after its end time", async () => {
	const { registry } = await initializeRegistry();

	const { epoch } = await registerEpoch({
	  registry,
	  startTs: nowUnixSeconds() - 7200,
	  endTs: nowUnixSeconds() - 3600,
	});

	await program.methods
	  .activateEpoch()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		epoch,
	  })
	  .rpc();

	await program.methods
	  .closeEpoch()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		epoch,
	  })
	  .rpc();

	const registryAccount = await program.account.epochRegistry.fetch(registry);
	const epochAccount = await program.account.physisEpoch.fetch(epoch);

	assert.strictEqual(epochAccount.status, EPOCH_STATUS_CLOSED);
	assert.strictEqual(registryAccount.currentEpoch, null);
	assert.strictEqual(registryAccount.latestClosedEpoch!.toBase58(), epoch.toBase58());
	assert.ok(epochAccount.closedAtTs.toNumber() > 0);
	assert.ok(epochAccount.closedAtSlot.toNumber() > 0);
	assert.ok(epochAccount.closedAtSolanaEpoch.toNumber() >= 0);
  });

  it("rejects register_epoch from the wrong authority", async () => {
	const { registry } = await initializeRegistry();
	const wrongAuthority = Keypair.generate();

	await expectRejects(
	  () =>
		registerEpoch({
		  registry,
		  authority: wrongAuthority,
		}),
	  "wrong authority cannot register epoch",
	);
  });

  it("rejects invalid epoch_id", async () => {
	const { registry } = await initializeRegistry();

	await expectRejects(
	  () =>
		registerEpoch({
		  registry,
		  epochId: 202699,
		}),
	  "invalid epoch_id rejected",
	);
  });

  it("rejects invalid calendar quarter", async () => {
	const { registry } = await initializeRegistry();

	await expectRejects(
	  () =>
		registerEpoch({
		  registry,
		  calendarQuarter: 5,
		}),
	  "invalid calendar quarter rejected",
	);
  });

  it("rejects invalid Physis quarter", async () => {
	const { registry } = await initializeRegistry();

	await expectRejects(
	  () =>
		registerEpoch({
		  registry,
		  epochId: 202605,
		  physisQuarter: 5,
		}),
	  "invalid Physis quarter rejected",
	);
  });

  it("rejects invalid epoch timestamps", async () => {
	const { registry } = await initializeRegistry();

	await expectRejects(
	  () =>
		registerEpoch({
		  registry,
		  startTs: nowUnixSeconds() + 3600,
		  endTs: nowUnixSeconds(),
		}),
	  "end_ts must be greater than start_ts",
	);
  });

  it("rejects register_epoch while registry is paused", async () => {
	const { registry } = await initializeRegistry();

	await program.methods
	  .pauseRegistry()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
	  })
	  .rpc();

	await expectRejects(
	  () => registerEpoch({ registry }),
	  "paused registry blocks register_epoch",
	);
  });

  it("rejects activate_epoch before start time", async () => {
	const { registry } = await initializeRegistry();

	const { epoch } = await registerEpoch({
	  registry,
	  startTs: nowUnixSeconds() + 3600,
	  endTs: nowUnixSeconds() + 7200,
	});

	await expectRejects(
	  () =>
		program.methods
		  .activateEpoch()
		  .accountsStrict({
			authority: provider.wallet.publicKey,
			registry,
			epoch,
		  })
		  .rpc(),
	  "cannot activate before start_ts",
	);
  });

  it("rejects close_epoch before end time", async () => {
	const { registry } = await initializeRegistry();

	const { epoch } = await registerEpoch({
	  registry,
	  startTs: nowUnixSeconds() - 3600,
	  endTs: nowUnixSeconds() + 3600,
	});

	await program.methods
	  .activateEpoch()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		epoch,
	  })
	  .rpc();

	await expectRejects(
	  () =>
		program.methods
		  .closeEpoch()
		  .accountsStrict({
			authority: provider.wallet.publicKey,
			registry,
			epoch,
		  })
		  .rpc(),
	  "cannot close before end_ts",
	);
  });

  it("rejects activating a second epoch while one is active", async () => {
	const { registry } = await initializeRegistry();

	const first = await registerEpoch({
	  registry,
	  epochId: 202602,
	  physisQuarter: 2,
	  startTs: nowUnixSeconds() - 3600,
	  endTs: nowUnixSeconds() + 3600,
	});

	const second = await registerEpoch({
	  registry,
	  epochId: 202603,
	  physisQuarter: 3,
	  calendarQuarter: 4,
	  label: "Q3",
	  startTs: nowUnixSeconds() - 3600,
	  endTs: nowUnixSeconds() + 3600,
	});

	await program.methods
	  .activateEpoch()
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		epoch: first.epoch,
	  })
	  .rpc();

	await expectRejects(
	  () =>
		program.methods
		  .activateEpoch()
		  .accountsStrict({
			authority: provider.wallet.publicKey,
			registry,
			epoch: second.epoch,
		  })
		  .rpc(),
	  "cannot activate second epoch while one is active",
	);
  });
});
