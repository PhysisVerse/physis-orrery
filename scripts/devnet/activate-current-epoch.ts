import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

type LocalnetConfig = {
  cluster: string;
  programId: string;
  realm: string;
};

function loadConfig(): LocalnetConfig {
  const configPath = path.resolve("configs/devnet.json");
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

function getCurrentPhysisEpochId(now = new Date()): number {
  const calendarYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();

  let physisYear: number;
  let physisQuarter: number;

  if (utcMonth >= 3 && utcMonth <= 5) {
	physisYear = calendarYear;
	physisQuarter = 1;
  } else if (utcMonth >= 6 && utcMonth <= 8) {
	physisYear = calendarYear;
	physisQuarter = 2;
  } else if (utcMonth >= 9 && utcMonth <= 11) {
	physisYear = calendarYear;
	physisQuarter = 3;
  } else {
	physisYear = calendarYear - 1;
	physisQuarter = 4;
  }

  return physisYear * 100 + physisQuarter;
}

async function main(): Promise<void> {
  const config = loadConfig();

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PhysisEpochRegistry as Program;

  if (program.programId.toBase58() !== config.programId) {
	throw new Error(
	  `Program ID mismatch. Config=${config.programId} Workspace=${program.programId.toBase58()}`,
	);
  }

  const realm = new PublicKey(config.realm);
  const registry = findRegistryPda(program.programId, realm);
  const epochId = getCurrentPhysisEpochId();
  const epoch = findEpochPda(program.programId, registry, epochId);

  console.log("Orrery: activate current Physis epoch");
  console.log("Cluster:", config.cluster);
  console.log("Program:", program.programId.toBase58());
  console.log("Registry PDA:", registry.toBase58());
  console.log("Epoch ID:", epochId);
  console.log("Epoch PDA:", epoch.toBase58());

  const epochAccount = await program.account.physisEpoch.fetch(epoch);

  if (epochAccount.status === 1) {
	console.log("Epoch is already active.");
	return;
  }

  const signature = await program.methods
	.activateEpoch()
	.accounts({
	  authority: provider.wallet.publicKey,
	  registry,
	  epoch,
	})
	.rpc();

  console.log("Epoch activated.");
  console.log("Signature:", signature);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
