import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import type { PhysisEpochRegistry } from "../../packages/idl-types/physis_epoch_registry.ts";
import {
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

type LocalnetConfig = {
  cluster: string;
  programId: string;
  realm: string;
};

type CurrentEpoch = {
  epochId: number;
  calendarYear: number;
  calendarQuarter: number;
  physisYear: number;
  physisQuarter: number;
  label: string;
  startTs: number;
  endTs: number;
};

function loadConfig(): LocalnetConfig {
  const configPath = path.resolve("configs/localnet.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as LocalnetConfig;
}

function findRegistryPda(programId: PublicKey, realm: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
	[
	  Buffer.from("physis"),
	  Buffer.from("epoch-registry"),
	  realm.toBuffer(),
	],
	programId,
  );

  return pda;
}

function findEpochPda(
  programId: PublicKey,
  registry: PublicKey,
  epochId: number,
): PublicKey {
  const epochIdBuffer = Buffer.alloc(4);
  epochIdBuffer.writeUInt32LE(epochId, 0);

  const [pda] = PublicKey.findProgramAddressSync(
	[
	  Buffer.from("physis"),
	  Buffer.from("epoch"),
	  registry.toBuffer(),
	  epochIdBuffer,
	],
	programId,
  );

  return pda;
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function labelBytes(label: string): [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
] {
  const bytes = new TextEncoder().encode(label);

  const out: [
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
  ] = [
	0, 0, 0, 0,
	0, 0, 0, 0,
	0, 0, 0, 0,
	0, 0, 0, 0,
  ];

  for (let i = 0; i < Math.min(bytes.length, 16); i += 1) {
	out[i] = bytes[i];
  }

  return out;
}

function getCurrentEpoch(now = new Date()): CurrentEpoch {
  const calendarYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth(); // Jan = 0
  const calendarQuarter = Math.floor(utcMonth / 3) + 1;

  let physisYear: number;
  let physisQuarter: number;
  let startDate: Date;
  let nextStartDate: Date;

  if (utcMonth >= 3 && utcMonth <= 5) {
	// Apr-Jun
	physisYear = calendarYear;
	physisQuarter = 1;
	startDate = new Date(Date.UTC(calendarYear, 3, 1, 0, 0, 0));
	nextStartDate = new Date(Date.UTC(calendarYear, 6, 1, 0, 0, 0));
  } else if (utcMonth >= 6 && utcMonth <= 8) {
	// Jul-Sep
	physisYear = calendarYear;
	physisQuarter = 2;
	startDate = new Date(Date.UTC(calendarYear, 6, 1, 0, 0, 0));
	nextStartDate = new Date(Date.UTC(calendarYear, 9, 1, 0, 0, 0));
  } else if (utcMonth >= 9 && utcMonth <= 11) {
	// Oct-Dec
	physisYear = calendarYear;
	physisQuarter = 3;
	startDate = new Date(Date.UTC(calendarYear, 9, 1, 0, 0, 0));
	nextStartDate = new Date(Date.UTC(calendarYear + 1, 0, 1, 0, 0, 0));
  } else {
	// Jan-Mar belongs to previous Physis year Q4
	physisYear = calendarYear - 1;
	physisQuarter = 4;
	startDate = new Date(Date.UTC(calendarYear, 0, 1, 0, 0, 0));
	nextStartDate = new Date(Date.UTC(calendarYear, 3, 1, 0, 0, 0));
  }

  const epochId = physisYear * 100 + physisQuarter;
  const label = `PY${physisYear}Q${physisQuarter}`;

  return {
	epochId,
	calendarYear,
	calendarQuarter,
	physisYear,
	physisQuarter,
	label,
	startTs: toUnixSeconds(startDate),
	endTs: toUnixSeconds(nextStartDate) - 1,
  };
}

async function main(): Promise<void> {
  const config = loadConfig();

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program =
  anchor.workspace.PhysisEpochRegistry as Program<PhysisEpochRegistry>;

  if (program.programId.toBase58() !== config.programId) {
	throw new Error(
	  `Program ID mismatch. Config=${config.programId} Workspace=${program.programId.toBase58()}`,
	);
  }

  const realm = new PublicKey(config.realm);
  const registry = findRegistryPda(program.programId, realm);
  const currentEpoch = getCurrentEpoch();
  const epoch = findEpochPda(program.programId, registry, currentEpoch.epochId);

  console.log("Orrery: register current Physis epoch");
  console.log("Cluster:", config.cluster);
  console.log("Program:", program.programId.toBase58());
  console.log("Registry PDA:", registry.toBase58());
  console.log("Epoch PDA:", epoch.toBase58());
  console.log("Epoch:", currentEpoch);

  try {
	await program.account.epochRegistry.fetch(registry);
  } catch {
	throw new Error("Registry is not initialized. Run initialize-registry first.");
  }

  try {
	const existing = await program.account.physisEpoch.fetch(epoch);

	console.log("Epoch already registered.");
	console.log("Epoch ID:", existing.epochId);
	console.log("Status:", existing.status);
	return;
  } catch {
	// Expected when epoch does not exist yet.
  }

  const signature = await program.methods
	.registerEpoch(
	  currentEpoch.epochId,
	  currentEpoch.calendarYear,
	  currentEpoch.calendarQuarter,
	  currentEpoch.physisYear,
	  currentEpoch.physisQuarter,
	  labelBytes(currentEpoch.label),
	  new anchor.BN(currentEpoch.startTs),
	  new anchor.BN(currentEpoch.endTs),
	)
	.accountsStrict({
	  payer: provider.wallet.publicKey,
	  authority: provider.wallet.publicKey,
	  registry,
	  epoch,
	  systemProgram: SystemProgram.programId,
	})
	.rpc();

  console.log("Epoch registered.");
  console.log("Signature:", signature);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
