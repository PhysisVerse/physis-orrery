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
  physisYearStartMonth: number;
  physisYearStartDay: number;
  astralisEpochZeroTs: number;
  astralisEpochDurationSeconds: number;
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

  console.log("Orrery: initialize Physis Epoch Registry");
  console.log("Cluster:", config.cluster);
  console.log("Program:", program.programId.toBase58());
  console.log("Realm:", realm.toBase58());
  console.log("Registry PDA:", registry.toBase58());
  console.log("Authority:", provider.wallet.publicKey.toBase58());

  try {
	const existing = await program.account.epochRegistry.fetch(registry);

	console.log("Registry already initialized.");
	console.log("Authority:", existing.authority.toBase58());
	console.log("Paused:", existing.paused);
	return;
  } catch {
	// Expected when registry does not exist yet.
  }

  const signature = await program.methods
	.initializeRegistry(
	  config.physisYearStartMonth,
	  config.physisYearStartDay,
	  new anchor.BN(config.astralisEpochZeroTs),
	  new anchor.BN(config.astralisEpochDurationSeconds),
	)
	.accountsStrict({
	  payer: provider.wallet.publicKey,
	  authority: provider.wallet.publicKey,
	  realm,
	  registry,
	  systemProgram: SystemProgram.programId,
	})
	.rpc();

  console.log("Registry initialized.");
  console.log("Signature:", signature);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
