import { PublicKey } from "@solana/web3.js";

export function findEligibilityRegistryPda(
  programId: PublicKey,
  realm: PublicKey,
): {
  pda: PublicKey;
  bump: number;
} {
  const [pda, bump] = PublicKey.findProgramAddressSync(
	[Buffer.from("physis"), Buffer.from("eligibility-registry"), realm.toBuffer()],
	programId,
  );

  return {
	pda,
	bump,
  };
}

export function findEligibilityClassPda(
  programId: PublicKey,
  registry: PublicKey,
  classId: number,
): {
  pda: PublicKey;
  bump: number;
} {
  const classIdBuffer = Buffer.alloc(4);
  classIdBuffer.writeUInt32LE(classId, 0);

  const [pda, bump] = PublicKey.findProgramAddressSync(
	[
	  Buffer.from("physis"),
	  Buffer.from("eligibility-class"),
	  registry.toBuffer(),
	  classIdBuffer,
	],
	programId,
  );

  return {
	pda,
	bump,
  };
}

export function findEligibilityRecordPda(
  programId: PublicKey,
  registry: PublicKey,
  subjectKind: number,
  subjectKey: number[] | Uint8Array,
  classId: number,
): {
  pda: PublicKey;
  bump: number;
} {
  const classIdBuffer = Buffer.alloc(4);
  classIdBuffer.writeUInt32LE(classId, 0);

  const [pda, bump] = PublicKey.findProgramAddressSync(
	[
	  Buffer.from("physis"),
	  Buffer.from("eligibility-record"),
	  registry.toBuffer(),
	  Buffer.from([subjectKind]),
	  Buffer.from(subjectKey),
	  classIdBuffer,
	],
	programId,
  );

  return {
	pda,
	bump,
  };
}
