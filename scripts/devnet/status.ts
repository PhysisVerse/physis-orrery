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

async function main(): Promise<void> {
  const config = loadConfig();

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PhysisEpochRegistry as Program;

  const realm = new PublicKey(config.realm);
  const registry = findRegistryPda(program.programId, realm);

  console.log("Orrery: Physis Epoch Registry status");
  console.log("Cluster:", config.cluster);
  console.log("Program:", program.programId.toBase58());
  console.log("Realm:", realm.toBase58());
  console.log("Registry PDA:", registry.toBase58());

  const registryAccount = await program.account.epochRegistry.fetch(registry);

  console.log({
	version: registryAccount.version,
	authority: registryAccount.authority.toBase58(),
	realm: registryAccount.realm.toBase58(),
	physisYearStartMonth: registryAccount.physisYearStartMonth,
	physisYearStartDay: registryAccount.physisYearStartDay,
	astralisEpochZeroTs: registryAccount.astralisEpochZeroTs.toString(),
	astralisEpochDurationSeconds:
	  registryAccount.astralisEpochDurationSeconds.toString(),
	currentEpoch: registryAccount.currentEpoch?.toBase58() ?? null,
	latestClosedEpoch: registryAccount.latestClosedEpoch?.toBase58() ?? null,
	paused: registryAccount.paused,
  });

  if (registryAccount.currentEpoch) {
	const epochAccount = await program.account.physisEpoch.fetch(
	  registryAccount.currentEpoch,
	);

	console.log("Current epoch:");
	console.log({
	  address: registryAccount.currentEpoch.toBase58(),
	  epochId: epochAccount.epochId,
	  calendarYear: epochAccount.calendarYear,
	  calendarQuarter: epochAccount.calendarQuarter,
	  physisYear: epochAccount.physisYear,
	  physisQuarter: epochAccount.physisQuarter,
	  startTs: epochAccount.startTs.toString(),
	  endTs: epochAccount.endTs.toString(),
	  status: epochAccount.status,
	  activatedAtTs: epochAccount.activatedAtTs.toString(),
	  activatedAtSlot: epochAccount.activatedAtSlot.toString(),
	  activatedAtSolanaEpoch: epochAccount.activatedAtSolanaEpoch.toString(),
	});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
