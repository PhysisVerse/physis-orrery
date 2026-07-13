import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import {
  Connection,
  PublicKey,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

import type {
  PhysisEligibilityRegistry,
} from "../../packages/idl-types/physis_eligibility_registry.ts";

export const GOVERNANCE_MODE_PRIVE_ONLY = 1;

export const CLASS_ID_PRIVE_MEMBER = 1;
export const CLASS_ID_PERSONA_VERIFIED = 2;

export const CLASS_KIND_PRIVE_MEMBER = 1;
export const CLASS_KIND_PERSONA_VERIFIED = 2;

export const CLASS_STATUS_ACTIVE = 1;

export const NAME_BYTES = 32;
export const LABEL_BYTES = 16;

export type EligibilityOperationalConfig = {
  cluster: string;
  epochProgramId: PublicKey;
  eligibilityProgramId: PublicKey;
  realm: PublicKey;
};

type RawConfig = Record<string, unknown>;

function requireString(
  config: RawConfig,
  key: string,
): string {
  const value = config[key];

  if (typeof value !== "string" || value.length === 0) {
	throw new Error(
	  `Configuration property "${key}" must be a non-empty string`,
	);
  }

  return value;
}

export function loadEligibilityConfig(
  network: "localnet" | "devnet",
): EligibilityOperationalConfig {
  const configPath = path.resolve(
	`configs/${network}.json`,
  );

  if (!fs.existsSync(configPath)) {
	throw new Error(
	  `Configuration file does not exist: ${configPath}`,
	);
  }

  const parsed: unknown = JSON.parse(
	fs.readFileSync(configPath, "utf8"),
  );

  if (
	typeof parsed !== "object" ||
	parsed === null ||
	Array.isArray(parsed)
  ) {
	throw new Error(
	  `Configuration must contain a JSON object: ${configPath}`,
	);
  }

  const config = parsed as RawConfig;

  return {
	cluster: requireString(config, "cluster"),
	epochProgramId: new PublicKey(
	  requireString(config, "programId"),
	),
	eligibilityProgramId: new PublicKey(
	  requireString(config, "eligibilityProgramId"),
	),
	realm: new PublicKey(
	  requireString(config, "realm"),
	),
  };
}

export function getEligibilityProgram():
  Program<PhysisEligibilityRegistry> {
  return anchor.workspace
	.PhysisEligibilityRegistry as Program<PhysisEligibilityRegistry>;
}

export function assertProgramId(
  actual: PublicKey,
  expected: PublicKey,
): void {
  if (!actual.equals(expected)) {
	throw new Error(
	  [
		"Program 2 ID mismatch.",
		`Configured: ${expected.toBase58()}`,
		`Workspace:  ${actual.toBase58()}`,
	  ].join("\n"),
	);
  }
}

export function findEpochRegistryPda(
  epochProgramId: PublicKey,
  realm: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
	[
	  Buffer.from("physis"),
	  Buffer.from("epoch-registry"),
	  realm.toBuffer(),
	],
	epochProgramId,
  );

  return pda;
}

export function findEligibilityRegistryPda(
  eligibilityProgramId: PublicKey,
  realm: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
	[
	  Buffer.from("physis"),
	  Buffer.from("eligibility-registry"),
	  realm.toBuffer(),
	],
	eligibilityProgramId,
  );

  return pda;
}

export function findEligibilityClassPda(
  eligibilityProgramId: PublicKey,
  registry: PublicKey,
  classId: number,
): PublicKey {
  const classIdBytes = Buffer.alloc(4);
  classIdBytes.writeUInt32LE(classId, 0);

  const [pda] = PublicKey.findProgramAddressSync(
	[
	  Buffer.from("physis"),
	  Buffer.from("eligibility-class"),
	  registry.toBuffer(),
	  classIdBytes,
	],
	eligibilityProgramId,
  );

  return pda;
}

export function fixedBytes(
  value: string,
  length: number,
): number[] {
  const encoded = Buffer.from(value, "utf8");

  if (encoded.length > length) {
	throw new Error(
	  `"${value}" exceeds the fixed ${length}-byte limit`,
	);
  }

  const result = Buffer.alloc(length);
  encoded.copy(result);

  return Array.from(result);
}

export function fixedBytesToString(
  value: number[],
): string {
  return Buffer.from(value)
	.toString("utf8")
	.replace(/\0+$/g, "");
}

export function fixedBytesEqual(
  actual: number[],
  expected: number[],
): boolean {
  return Buffer.from(actual).equals(
	Buffer.from(expected),
  );
}

export async function requireOwnedAccount(
  connection: Connection,
  address: PublicKey,
  expectedOwner: PublicKey,
  label: string,
): Promise<void> {
  const account = await connection.getAccountInfo(
	address,
  );

  if (!account) {
	throw new Error(
	  `${label} does not exist: ${address.toBase58()}`,
	);
  }

  if (!account.owner.equals(expectedOwner)) {
	throw new Error(
	  [
		`${label} has the wrong owner.`,
		`Address:  ${address.toBase58()}`,
		`Expected: ${expectedOwner.toBase58()}`,
		`Actual:   ${account.owner.toBase58()}`,
	  ].join("\n"),
	);
  }
}

export async function accountExists(
  connection: Connection,
  address: PublicKey,
): Promise<boolean> {
  return (
	await connection.getAccountInfo(address)
  ) !== null;
}
