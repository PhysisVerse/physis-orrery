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
