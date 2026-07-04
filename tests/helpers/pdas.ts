import { PublicKey } from "@solana/web3.js";

export function findRegistryPda(programId: PublicKey, realm: PublicKey): PublicKey {
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

export function findEpochPda(
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
