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
  accountExists,
  assertProgramId,
  findEligibilityClassPda,
  findEligibilityRegistryPda,
  getEligibilityProgram,
  loadEligibilityConfig,
  requireOwnedAccount,
} from "../shared/eligibility.ts";

const SUBJECT_KIND_WALLET = 1;

const RECORD_STATUS_ACTIVE = 1;
const RECORD_STATUS_SUSPENDED = 2;
const RECORD_STATUS_REVOKED = 3;

const ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED = 2;

const METADATA_HASH_BYTES = 32;

function pubkeyBytes(pubkey: PublicKey): number[] {
  return Array.from(pubkey.toBytes());
}

function zeroBytes(length: number): number[] {
  return Array.from(Buffer.alloc(length));
}

function bytesEqual(
  actual: number[],
  expected: number[],
): boolean {
  return Buffer.from(actual).equals(
	Buffer.from(expected),
  );
}

function requireCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
	throw new Error(message);
  }
}

function findEligibilityRecordPda(
  programId: PublicKey,
  registry: PublicKey,
  subjectKey: number[],
): PublicKey {
  const classIdBytes = Buffer.alloc(4);
  classIdBytes.writeUInt32LE(
	CLASS_ID_PRIVE_MEMBER,
	0,
  );

  const [pda] = PublicKey.findProgramAddressSync(
	[
	  Buffer.from("physis"),
	  Buffer.from("eligibility-record"),
	  registry.toBuffer(),
	  Buffer.from([SUBJECT_KIND_WALLET]),
	  Buffer.from(subjectKey),
	  classIdBytes,
	],
	programId,
  );

  return pda;
}

async function main(): Promise<void> {
  const config = loadEligibilityConfig("localnet");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assertProgramId(
	program.programId,
	config.eligibilityProgramId,
  );

  const registry = findEligibilityRegistryPda(
	program.programId,
	config.realm,
  );

  const eligibilityClass =
	findEligibilityClassPda(
	  program.programId,
	  registry,
	  CLASS_ID_PRIVE_MEMBER,
	);

  await requireOwnedAccount(
	provider.connection,
	registry,
	program.programId,
	"Program 2 eligibility registry",
  );

  await requireOwnedAccount(
	provider.connection,
	eligibilityClass,
	program.programId,
	"PRIVE_MEMBER eligibility class",
  );

  const registryBefore =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  const classAccount =
	await program.account.eligibilityClass.fetch(
	  eligibilityClass,
	);

  requireCondition(
	registryBefore.realm.equals(config.realm),
	"Eligibility registry Realm mismatch",
  );

  requireCondition(
	registryBefore.authority.equals(
	  provider.wallet.publicKey,
	),
	[
	  "Connected wallet is not the Program 2 registry authority.",
	  `Expected: ${registryBefore.authority.toBase58()}`,
	  `Actual:   ${provider.wallet.publicKey.toBase58()}`,
	].join("\n"),
  );

  requireCondition(
	!registryBefore.paused,
	"Eligibility registry is paused",
  );

  requireCondition(
	registryBefore.classCount === 2,
	`Expected 2 canonical v1 classes, found ${registryBefore.classCount}`,
  );

  requireCondition(
	classAccount.registry.equals(registry),
	"PRIVE_MEMBER class registry mismatch",
  );

  requireCondition(
	classAccount.classId ===
	  CLASS_ID_PRIVE_MEMBER,
	"PRIVE_MEMBER class ID mismatch",
  );

  requireCondition(
	classAccount.kind ===
	  CLASS_KIND_PRIVE_MEMBER,
	"PRIVE_MEMBER class kind mismatch",
  );

  requireCondition(
	classAccount.status ===
	  CLASS_STATUS_ACTIVE,
	"PRIVE_MEMBER class is not Active",
  );

  requireCondition(
	classAccount.enabled,
	"PRIVE_MEMBER class is not enabled",
  );

  const disposableWallet =
	Keypair.generate().publicKey;

  const subjectKey =
	pubkeyBytes(disposableWallet);

  const eligibilityRecord =
	findEligibilityRecordPda(
	  program.programId,
	  registry,
	  subjectKey,
	);

  const recordAlreadyExists =
	await accountExists(
	  provider.connection,
	  eligibilityRecord,
	);

  requireCondition(
	!recordAlreadyExists,
	"Generated lifecycle record already exists unexpectedly",
  );

  const initialRecordCount =
	registryBefore.recordCount;

  const expectedRecordCount =
	initialRecordCount.add(new anchor.BN(1));

  console.log(
	"Orrery: Program 2 record lifecycle smoke test",
  );

  console.log({
	cluster: config.cluster,
	program: program.programId.toBase58(),
	registry: registry.toBase58(),
	eligibilityClass:
	  eligibilityClass.toBase58(),
	authority:
	  provider.wallet.publicKey.toBase58(),
	disposableWallet:
	  disposableWallet.toBase58(),
	eligibilityRecord:
	  eligibilityRecord.toBase58(),
	initialRecordCount:
	  initialRecordCount.toString(),
  });

  const createSignature =
	await program.methods
	  .upsertEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
		disposableWallet,
		RECORD_STATUS_ACTIVE,
		ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		provider.wallet.publicKey,
		zeroBytes(METADATA_HASH_BYTES),
		0,
		0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		eligibilityRecord,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

  const created =
	await program.account.eligibilityRecord.fetch(
	  eligibilityRecord,
	);

  const registryAfterCreate =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  requireCondition(
	created.registry.equals(registry),
	"Created record registry mismatch",
  );

  requireCondition(
	created.eligibilityClass.equals(
	  eligibilityClass,
	),
	"Created record class mismatch",
  );

  requireCondition(
	created.classId ===
	  CLASS_ID_PRIVE_MEMBER,
	"Created record class ID mismatch",
  );

  requireCondition(
	created.subjectKind ===
	  SUBJECT_KIND_WALLET,
	"Created record subject kind mismatch",
  );

  requireCondition(
	bytesEqual(
	  created.subjectKey,
	  subjectKey,
	),
	"Created record subject key mismatch",
  );

  requireCondition(
	created.wallet.equals(disposableWallet),
	"Created record wallet mismatch",
  );

  requireCondition(
	created.status === RECORD_STATUS_ACTIVE,
	"Created record is not Active",
  );

  requireCondition(
	created.source ===
	  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
	"Created record source mismatch",
  );

  requireCondition(
	created.issuer.equals(
	  provider.wallet.publicKey,
	),
	"Created record issuer mismatch",
  );

  requireCondition(
	registryAfterCreate.recordCount.eq(
	  expectedRecordCount,
	),
	[
	  "recordCount did not increment exactly once.",
	  `Expected: ${expectedRecordCount.toString()}`,
	  `Actual:   ${registryAfterCreate.recordCount.toString()}`,
	].join("\n"),
  );

  const createdTs = created.createdTs;
  const createdSlot = created.createdSlot;

  console.log("ACTIVE record created and verified.");
  console.log("Signature:", createSignature);

  const suspendSignature =
	await program.methods
	  .suspendEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		eligibilityRecord,
	  })
	  .rpc();

  const suspended =
	await program.account.eligibilityRecord.fetch(
	  eligibilityRecord,
	);

  const registryAfterSuspend =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  requireCondition(
	suspended.status ===
	  RECORD_STATUS_SUSPENDED,
	"Record was not suspended",
  );

  requireCondition(
	suspended.createdTs.eq(createdTs),
	"Suspension changed record createdTs",
  );

  requireCondition(
	suspended.createdSlot.eq(createdSlot),
	"Suspension changed record createdSlot",
  );

  requireCondition(
	registryAfterSuspend.recordCount.eq(
	  expectedRecordCount,
	),
	"Suspension changed recordCount",
  );

  console.log("Record suspended and verified.");
  console.log("Signature:", suspendSignature);

  const reactivateSignature =
	await program.methods
	  .upsertEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
		disposableWallet,
		RECORD_STATUS_ACTIVE,
		ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED,
		provider.wallet.publicKey,
		zeroBytes(METADATA_HASH_BYTES),
		0,
		0,
	  )
	  .accountsStrict({
		payer: provider.wallet.publicKey,
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		eligibilityRecord,
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

  const reactivated =
	await program.account.eligibilityRecord.fetch(
	  eligibilityRecord,
	);

  const registryAfterReactivate =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  requireCondition(
	reactivated.status ===
	  RECORD_STATUS_ACTIVE,
	"Record was not reactivated",
  );

  requireCondition(
	reactivated.createdTs.eq(createdTs),
	"Reactivation changed record createdTs",
  );

  requireCondition(
	reactivated.createdSlot.eq(createdSlot),
	"Reactivation changed record createdSlot",
  );

  requireCondition(
	registryAfterReactivate.recordCount.eq(
	  expectedRecordCount,
	),
	"Reactivation changed recordCount",
  );

  console.log("Record reactivated and verified.");
  console.log("Signature:", reactivateSignature);

  const revokeSignature =
	await program.methods
	  .revokeEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		eligibilityRecord,
	  })
	  .rpc();

  const revoked =
	await program.account.eligibilityRecord.fetch(
	  eligibilityRecord,
	);

  const registryAfterRevoke =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  requireCondition(
	revoked.status === RECORD_STATUS_REVOKED,
	"Record was not revoked",
  );

  requireCondition(
	revoked.createdTs.eq(createdTs),
	"Revocation changed record createdTs",
  );

  requireCondition(
	revoked.createdSlot.eq(createdSlot),
	"Revocation changed record createdSlot",
  );

  requireCondition(
	registryAfterRevoke.recordCount.eq(
	  expectedRecordCount,
	),
	"Revocation changed recordCount",
  );

  console.log("Record revoked and verified.");
  console.log("Signature:", revokeSignature);

  let duplicateRevocationRejected = false;
  let duplicateRevocationError: unknown;
  
  try {
	await program.methods
	  .revokeEligibilityRecord(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
	  )
	  .accountsStrict({
		authority: provider.wallet.publicKey,
		registry,
		eligibilityClass,
		eligibilityRecord,
	  })
	  .rpc();
  } catch (error: unknown) {
	duplicateRevocationRejected = true;
	duplicateRevocationError = error;
  }
  
  requireCondition(
	duplicateRevocationRejected,
	"Duplicate record revocation unexpectedly succeeded",
  );
  
  if (duplicateRevocationError instanceof Error) {
	console.log(
	  "Duplicate revocation rejection:",
	  duplicateRevocationError.message
		.split("\n")[0],
	);
  }

  const finalRecord =
	await program.account.eligibilityRecord.fetch(
	  eligibilityRecord,
	);

  const finalRegistry =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  requireCondition(
	finalRecord.status ===
	  RECORD_STATUS_REVOKED,
	"Final record state is not Revoked",
  );

  requireCondition(
	finalRegistry.recordCount.eq(
	  expectedRecordCount,
	),
	"Final registry recordCount is incorrect",
  );

  console.log(
	"Duplicate revocation correctly rejected.",
  );

  console.log(
	"Program 2 record lifecycle smoke test passed.",
  );

  console.log({
	eligibilityRecord:
	  eligibilityRecord.toBase58(),
	disposableWallet:
	  disposableWallet.toBase58(),
	finalStatus: finalRecord.status,
	finalRecordCount:
	  finalRegistry.recordCount.toString(),
  });
}

main().catch((error: unknown) => {
  console.error(
	error instanceof Error
	  ? error.message
	  : error,
  );

  process.exit(1);
});
