import * as anchor from "@anchor-lang/core";
import {
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

import {
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  METADATA_HASH_BYTES,
  NAME_BYTES,
  RECORD_STATUS_ACTIVE,
  SUBJECT_KIND_WALLET,
} from "./eligibility-constants.ts";

import {
  findEligibilityClassPda,
  findEligibilityRecordPda,
  findEligibilityRegistryPda,
  findIssuerGrantPda,
} from "./eligibility-pdas.ts";

import {
  initializeCanonicalEpochRegistry,
} from "./epoch-registry-fixture.ts";

import {
  getEligibilityProgram,
} from "./eligibility-program.ts";

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const program = getEligibilityProgram();

export function fixedBytes(
  value: string,
  length: number,
): number[] {
  const bytes = Buffer.alloc(length);
  bytes.write(value, "utf8");
  return Array.from(bytes);
}

export function zeroBytes(
  length: number,
): number[] {
  return Array.from(Buffer.alloc(length));
}

export function metadataHash(
  seed: number,
): number[] {
  const bytes = Buffer.alloc(
    METADATA_HASH_BYTES,
  );

  bytes.writeUInt32LE(seed, 0);
  bytes[METADATA_HASH_BYTES - 1] = 1;

  return Array.from(bytes);
}

export function pubkeyBytes(
  pubkey: PublicKey,
): number[] {
  return Array.from(pubkey.toBytes());
}

export function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function initializeEligibilityRegistry():
Promise<PublicKey> {
  const realm = Keypair.generate();

  const epochRegistry =
    await initializeCanonicalEpochRegistry(
      realm.publicKey,
    );

  const { pda: registry } =
    findEligibilityRegistryPda(
      program.programId,
      realm.publicKey,
    );

  await program.methods
    .initializeRegistry(
      GOVERNANCE_MODE_PRIVE_ONLY,
    )
    .accountsStrict({
      payer: provider.wallet.publicKey,
      authority: provider.wallet.publicKey,
      realm: realm.publicKey,
      epochRegistry,
      registry,
      systemProgram:
        SystemProgram.programId,
    })
    .rpc();

  return registry;
}

export async function createPriveClass(
  registry: PublicKey,
): Promise<PublicKey> {
  const { pda: eligibilityClass } =
    findEligibilityClassPda(
      program.programId,
      registry,
      CLASS_ID_PRIVE_MEMBER,
    );

  await program.methods
    .upsertEligibilityClass(
      CLASS_ID_PRIVE_MEMBER,
      fixedBytes(
        "PRIVE_MEMBER",
        NAME_BYTES,
      ),
      fixedBytes("PRIVE", LABEL_BYTES),
      CLASS_KIND_PRIVE_MEMBER,
      CLASS_STATUS_ACTIVE,
      true,
      true,
      false,
      PublicKey.default,
      new anchor.BN(0),
      0,
      0,
    )
    .accountsStrict({
      payer: provider.wallet.publicKey,
      authority: provider.wallet.publicKey,
      registry,
      eligibilityClass,
      systemProgram:
        SystemProgram.programId,
    })
    .rpc();

  return eligibilityClass;
}

export async function createPriveFixture() {
  const registry =
    await initializeEligibilityRegistry();

  const eligibilityClass =
    await createPriveClass(registry);

  return {
    registry,
    eligibilityClass,
  };
}

export async function upsertPriveIssuerGrant(
  params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    issuer: PublicKey;
    permissions: number;
    maxEvidenceTtlSeconds?: number;
    validFromTs?: number;
    validUntilTs?: number;
  },
): Promise<PublicKey> {
  const { pda: issuerGrant } =
    findIssuerGrantPda(
      program.programId,
      params.registry,
      CLASS_ID_PRIVE_MEMBER,
      params.issuer,
    );

  await program.methods
    .upsertIssuerGrant(
      CLASS_ID_PRIVE_MEMBER,
      params.issuer,
      ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
      params.permissions,
      params.maxEvidenceTtlSeconds ??
        3600,
      new anchor.BN(
        params.validFromTs ?? 0,
      ),
      new anchor.BN(
        params.validUntilTs ?? 0,
      ),
    )
    .accountsStrict({
      payer: provider.wallet.publicKey,
      authority: provider.wallet.publicKey,
      registry: params.registry,
      eligibilityClass:
        params.eligibilityClass,
      issuerGrant,
      systemProgram:
        SystemProgram.programId,
    })
    .rpc();

  return issuerGrant;
}

export async function disablePriveIssuerGrant(
  params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    issuer: PublicKey;
  },
): Promise<void> {
  const { pda: issuerGrant } =
    findIssuerGrantPda(
      program.programId,
      params.registry,
      CLASS_ID_PRIVE_MEMBER,
      params.issuer,
    );

  await program.methods
    .disableIssuerGrant(
      CLASS_ID_PRIVE_MEMBER,
      params.issuer,
    )
    .accountsStrict({
      authority: provider.wallet.publicKey,
      registry: params.registry,
      eligibilityClass:
        params.eligibilityClass,
      issuerGrant,
    })
    .rpc();
}

export async function upsertPriveRecordByIssuer(
  params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    issuer: Keypair;
    wallet?: PublicKey;
    status?: number;
    metadataHash?: number[];
    evidenceExpiresAt?: number;
  },
) {
  const wallet =
    params.wallet ??
    Keypair.generate().publicKey;

  const subjectKey = pubkeyBytes(wallet);

  const { pda: issuerGrant } =
    findIssuerGrantPda(
      program.programId,
      params.registry,
      CLASS_ID_PRIVE_MEMBER,
      params.issuer.publicKey,
    );

  const { pda: eligibilityRecord } =
    findEligibilityRecordPda(
      program.programId,
      params.registry,
      SUBJECT_KIND_WALLET,
      subjectKey,
      CLASS_ID_PRIVE_MEMBER,
    );

  const signature =
    await program.methods
      .upsertEligibilityRecordByIssuer(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        subjectKey,
        wallet,
        params.status ??
          RECORD_STATUS_ACTIVE,
        params.metadataHash ??
          metadataHash(1),
        0,
        0,
        new anchor.BN(
          params.evidenceExpiresAt ??
            nowUnixSeconds() + 300,
        ),
      )
      .accountsStrict({
        payer: provider.wallet.publicKey,
        issuer: params.issuer.publicKey,
        registry: params.registry,
        eligibilityClass:
          params.eligibilityClass,
        issuerGrant,
        eligibilityRecord,
        systemProgram:
          SystemProgram.programId,
      })
      .signers([params.issuer])
      .rpc();

  return {
    signature,
    wallet,
    subjectKey,
    eligibilityRecord,
  };
}

export async function upsertPriveDaoOverride(
  params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    wallet: PublicKey;
  },
): Promise<PublicKey> {
  const subjectKey =
    pubkeyBytes(params.wallet);

  const { pda: eligibilityRecord } =
    findEligibilityRecordPda(
      program.programId,
      params.registry,
      SUBJECT_KIND_WALLET,
      subjectKey,
      CLASS_ID_PRIVE_MEMBER,
    );

  await program.methods
    .upsertEligibilityRecordByAuthority(
      CLASS_ID_PRIVE_MEMBER,
      SUBJECT_KIND_WALLET,
      subjectKey,
      params.wallet,
      RECORD_STATUS_ACTIVE,
      ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
      metadataHash(9_001),
      0,
      0,
      new anchor.BN(0),
    )
    .accountsStrict({
      payer: provider.wallet.publicKey,
      authority: provider.wallet.publicKey,
      registry: params.registry,
      eligibilityClass:
        params.eligibilityClass,
      eligibilityRecord,
      systemProgram:
        SystemProgram.programId,
    })
    .rpc();

  return eligibilityRecord;
}

export async function suspendPriveRecord(
  params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    wallet: PublicKey;
  },
): Promise<void> {
  const subjectKey =
    pubkeyBytes(params.wallet);

  const { pda: eligibilityRecord } =
    findEligibilityRecordPda(
      program.programId,
      params.registry,
      SUBJECT_KIND_WALLET,
      subjectKey,
      CLASS_ID_PRIVE_MEMBER,
    );

  await program.methods
    .suspendEligibilityRecord(
      CLASS_ID_PRIVE_MEMBER,
      SUBJECT_KIND_WALLET,
      subjectKey,
    )
    .accountsStrict({
      authority: provider.wallet.publicKey,
      registry: params.registry,
      eligibilityClass:
        params.eligibilityClass,
      eligibilityRecord,
    })
    .rpc();
}

export async function revokePriveRecord(
  params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    wallet: PublicKey;
  },
): Promise<void> {
  const subjectKey =
    pubkeyBytes(params.wallet);

  const { pda: eligibilityRecord } =
    findEligibilityRecordPda(
      program.programId,
      params.registry,
      SUBJECT_KIND_WALLET,
      subjectKey,
      CLASS_ID_PRIVE_MEMBER,
    );

  await program.methods
    .revokeEligibilityRecord(
      CLASS_ID_PRIVE_MEMBER,
      SUBJECT_KIND_WALLET,
      subjectKey,
    )
    .accountsStrict({
      authority: provider.wallet.publicKey,
      registry: params.registry,
      eligibilityClass:
        params.eligibilityClass,
      eligibilityRecord,
    })
    .rpc();
}
