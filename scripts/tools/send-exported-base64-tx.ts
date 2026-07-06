import {
  Connection,
  Keypair,
  Transaction,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import fs from "fs";
import os from "os";
import path from "path";

function expandHome(filePath: string): string {
  if (filePath === "~") return os.homedir();

  if (filePath.startsWith("~/")) {
	return path.join(os.homedir(), filePath.slice(2));
  }

  return filePath;
}

function loadKeypair(filePath: string): Keypair {
  const expandedPath = expandHome(filePath);
  const raw = JSON.parse(fs.readFileSync(expandedPath, "utf8")) as number[];

  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function loadBase64Payloads(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, "utf8").trim();

  const lines = raw
	.split(/\r?\n/)
	.map((line) => line.trim())
	.filter(Boolean);

  const candidates = lines.filter((line) => /^[A-Za-z0-9+/=]+$/.test(line));

  if (candidates.length === 0) {
	throw new Error("No base64 transaction/message lines found in file.");
  }

  return candidates;
}

async function sendVersionedTransaction(
  connection: Connection,
  payloadBytes: Buffer,
  payer: Keypair,
): Promise<string | null> {
  try {
	const tx = VersionedTransaction.deserialize(payloadBytes);
	tx.sign([payer]);

	return await connection.sendTransaction(tx, {
	  skipPreflight: false,
	  maxRetries: 5,
	});
  } catch {
	return null;
  }
}

async function sendVersionedMessage(
  connection: Connection,
  payloadBytes: Buffer,
  payer: Keypair,
): Promise<string | null> {
  try {
	const message = VersionedMessage.deserialize(new Uint8Array(payloadBytes));
	const tx = new VersionedTransaction(message);

	tx.sign([payer]);

	return await connection.sendTransaction(tx, {
	  skipPreflight: false,
	  maxRetries: 5,
	});
  } catch {
	return null;
  }
}

async function sendLegacyTransaction(
  connection: Connection,
  payloadBytes: Buffer,
  payer: Keypair,
): Promise<string | null> {
  try {
	const latestBlockhash = await connection.getLatestBlockhash("confirmed");
	const tx = Transaction.from(payloadBytes);

	tx.recentBlockhash = latestBlockhash.blockhash;
	tx.feePayer = payer.publicKey;
	tx.sign(payer);

	return await connection.sendRawTransaction(tx.serialize(), {
	  skipPreflight: false,
	  maxRetries: 5,
	});
  } catch {
	return null;
  }
}

async function sendExportedPayload(
  connection: Connection,
  payloadBytes: Buffer,
  payer: Keypair,
): Promise<string> {
  const versionedTxSig = await sendVersionedTransaction(
	connection,
	payloadBytes,
	payer,
  );

  if (versionedTxSig) return versionedTxSig;

  const versionedMessageSig = await sendVersionedMessage(
	connection,
	payloadBytes,
	payer,
  );

  if (versionedMessageSig) return versionedMessageSig;

  const legacySig = await sendLegacyTransaction(connection, payloadBytes, payer);

  if (legacySig) return legacySig;

  throw new Error(
	"Unable to deserialize payload as VersionedTransaction, VersionedMessage, or legacy Transaction.",
  );
}

async function main(): Promise<void> {
  const rpcUrl = process.env.HELIUS_MAINNET_RPC;

  if (!rpcUrl) {
	throw new Error("HELIUS_MAINNET_RPC is not set.");
  }

  const txPath = process.argv[2];

  if (!txPath) {
	throw new Error(
	  "Usage: yarn tsx scripts/tools/send-exported-base64-tx.ts <base64-file>",
	);
  }

  const walletPath = process.env.ANCHOR_WALLET ?? "~/.config/solana/id.json";

  const payer = loadKeypair(walletPath);
  const connection = new Connection(rpcUrl, "confirmed");

  const payloads = loadBase64Payloads(txPath);

  console.log("Sender:", payer.publicKey.toBase58());
  console.log("Payload count:", payloads.length);

  for (let i = 0; i < payloads.length; i += 1) {
	const payload = payloads[i];
	const payloadBytes = Buffer.from(payload, "base64");

	console.log(`Sending payload ${i + 1}/${payloads.length}`);
	console.log("Payload bytes:", payloadBytes.length);

	const signature = await sendExportedPayload(connection, payloadBytes, payer);

	console.log("Signature:", signature);

	const confirmation = await connection.confirmTransaction(
	  signature,
	  "confirmed",
	);

	if (confirmation.value.err) {
	  throw new Error(
		`Transaction ${i + 1} failed: ${JSON.stringify(confirmation.value.err)}`,
	  );
	}

	console.log(`Confirmed payload ${i + 1}/${payloads.length}`);
  }

  console.log("All payloads confirmed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
