import {
  Keypair,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

function requireCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function loadRestrictedKeypairFile(
  keypairPath: string,
  label: string,
): Keypair {
  requireCondition(
    path.isAbsolute(keypairPath),
    `${label} path must be absolute`,
  );

  const resolved =
    path.resolve(keypairPath);

  requireCondition(
    fs.existsSync(resolved),
    `${label} does not exist: ${resolved}`,
  );

  const linkStat =
    fs.lstatSync(resolved);

  requireCondition(
    !linkStat.isSymbolicLink(),
    `${label} cannot be a symbolic link: ${resolved}`,
  );

  requireCondition(
    linkStat.isFile(),
    `${label} is not a regular file: ${resolved}`,
  );

  if (
    typeof process.getuid === "function"
  ) {
    requireCondition(
      linkStat.uid === process.getuid(),
      `${label} is not owned by the current user: ${resolved}`,
    );
  }

  if (process.platform !== "win32") {
    requireCondition(
      (linkStat.mode & 0o077) === 0,
      [
        `${label} permissions are too broad.`,
        `Path: ${resolved}`,
        "Required: no group or other permissions (for example chmod 600).",
      ].join("\n"),
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      fs.readFileSync(
        resolved,
        "utf8",
      ),
    );
  } catch {
    throw new Error(
      `${label} is not valid JSON: ${resolved}`,
    );
  }

  requireCondition(
    Array.isArray(parsed) &&
      parsed.length === 64 &&
      parsed.every(
        (value) =>
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 255,
      ),
    `${label} must contain a 64-byte Solana keypair array: ${resolved}`,
  );

  return Keypair.fromSecretKey(
    Uint8Array.from(
      parsed as number[],
    ),
  );
}
