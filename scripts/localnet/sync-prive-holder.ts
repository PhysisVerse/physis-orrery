import * as anchor from "@anchor-lang/core";
import {
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
  fixedBytesToString,
  getEligibilityProgram,
  loadEligibilityConfig,
  requireOwnedAccount,
} from "../shared/eligibility.ts";

import {
  loadRestrictedKeypairFile,
} from "../shared/keypair.ts";

import {
  parsePriveCollections,
  verifyPriveOwnership,
} from "../shared/prive-ownership.ts";

import {
  RECORD_STATUS_ACTIVE,
  SOURCE_PRIVE_COLLECTION_VERIFIED,
  buildPriveEvidenceHash,
  metadataHashesEqual,
  planPriveSync,
} from "../shared/prive-sync-policy.ts";

const SUBJECT_KIND_WALLET = 1;
const VALID_FROM_EPOCH_ID = 0;
const VALID_UNTIL_EPOCH_ID = 0;

const ISSUER_GRANT_VERSION = 1;
const ISSUER_PERMISSION_CREATE = 1;
const ISSUER_PERMISSION_REFRESH = 1 << 1;
const ISSUER_PERMISSION_ACTIVATE_PENDING = 1 << 2;

const DEFAULT_EVIDENCE_TTL_SECONDS = 86_400;

interface WalletSelection {
  wallet: string;
  source:
	| "PRIVE_TEST_HOLDER"
	| "PRIVE_TEST_NON_HOLDER"
	| "command-line argument";
  expectedEligible: boolean | null;
}

function requireCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
	throw new Error(message);
  }
}

function requireEnvironmentVariable(
  name: string,
): string {
  const value =
	process.env[name]?.trim();

  if (!value) {
	throw new Error(
	  `Missing required environment variable: ${name}`,
	);
  }

  return value;
}

function optionalPositiveInteger(
  name: string,
  fallback: number,
): number {
  const raw =
	process.env[name]?.trim();

  if (!raw) {
	return fallback;
  }

  const value = Number(raw);

  requireCondition(
	Number.isSafeInteger(value) &&
	  value > 0,
	`${name} must be a positive safe integer`,
  );

  return value;
}

async function currentChainTimestamp(
  connection: anchor.web3.Connection,
): Promise<anchor.BN> {
  const slot =
	await connection.getSlot("confirmed");

  const blockTime =
	await connection.getBlockTime(slot);

  requireCondition(
	blockTime !== null,
	`Block time is unavailable for slot ${slot}`,
  );

  return new anchor.BN(blockTime);
}

function requiredIssuerPermission(
  action: string,
): number {
  switch (action) {
	case "create-active":
	  return ISSUER_PERMISSION_CREATE;

	case "activate-pending":
	  return ISSUER_PERMISSION_ACTIVATE_PENDING;

	case "refresh-evidence":
	  return ISSUER_PERMISSION_REFRESH;

	default:
	  throw new Error(
		`Unsupported mutating PRIVÉ sync action: ${action}`,
	  );
  }
}

function resolveWalletSelection(): WalletSelection {
  const args = process.argv.slice(2);

  if (args.length > 1) {
	throw new Error(
	  [
		"Too many command-line arguments.",
		"",
		"Usage:",
		"  sync-prive-holder.ts",
		"  sync-prive-holder.ts --holder",
		"  sync-prive-holder.ts --non-holder",
		"  sync-prive-holder.ts <WALLET>",
	  ].join("\n"),
	);
  }

  const selector =
	args[0]?.trim();

  if (
	selector === undefined ||
	selector === "--holder"
  ) {
	return {
	  wallet:
		requireEnvironmentVariable(
		  "PRIVE_TEST_HOLDER",
		),
	  source: "PRIVE_TEST_HOLDER",
	  expectedEligible: true,
	};
  }

  if (selector === "--non-holder") {
	return {
	  wallet:
		requireEnvironmentVariable(
		  "PRIVE_TEST_NON_HOLDER",
		),
	  source:
		"PRIVE_TEST_NON_HOLDER",
	  expectedEligible: false,
	};
  }

  if (selector.startsWith("--")) {
	throw new Error(
	  `Unknown option: ${selector}`,
	);
  }

  return {
	wallet: selector,
	source: "command-line argument",
	expectedEligible: null,
  };
}

function requireLocalRpcEndpoint(
  endpoint: string,
): void {
  let parsed: URL;

  try {
	parsed = new URL(endpoint);
  } catch {
	throw new Error(
	  `Program 2 RPC endpoint is invalid: ${endpoint}`,
	);
  }

  const allowedHosts = new Set([
	"127.0.0.1",
	"localhost",
	"::1",
	"[::1]",
  ]);

  requireCondition(
	allowedHosts.has(parsed.hostname),
	[
	  "Refusing to run the local PRIVÉ synchronizer against a non-local RPC.",
	  `RPC endpoint: ${endpoint}`,
	].join("\n"),
  );
}

function publicKeyBytes(
  value: PublicKey,
): number[] {
  return Array.from(value.toBytes());
}

function bytesEqual(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return Buffer.from(left).equals(
	Buffer.from(right),
  );
}

function findEligibilityRecordPda(
  programId: PublicKey,
  registry: PublicKey,
  subjectKey: readonly number[],
): PublicKey {
  const classIdBytes =
	Buffer.alloc(4);

  classIdBytes.writeUInt32LE(
	CLASS_ID_PRIVE_MEMBER,
	0,
  );

  const [record] =
	PublicKey.findProgramAddressSync(
	  [
		Buffer.from("physis"),
		Buffer.from(
		  "eligibility-record",
		),
		registry.toBuffer(),
		Buffer.from([
		  SUBJECT_KIND_WALLET,
		]),
		Buffer.from(subjectKey),
		classIdBytes,
	  ],
	  programId,
	);

  return record;
}

function findIssuerGrantPda(
  programId: PublicKey,
  registry: PublicKey,
  issuer: PublicKey,
): PublicKey {
  const classIdBytes =
	Buffer.alloc(4);

  classIdBytes.writeUInt32LE(
	CLASS_ID_PRIVE_MEMBER,
	0,
  );

  const [issuerGrant] =
	PublicKey.findProgramAddressSync(
	  [
		Buffer.from("physis"),
		Buffer.from(
		  "eligibility-issuer",
		),
		registry.toBuffer(),
		classIdBytes,
		issuer.toBuffer(),
	  ],
	  programId,
	);

  return issuerGrant;
}

async function main(): Promise<void> {
  const selection =
	resolveWalletSelection();

  const heliusMainnetRpc =
	requireEnvironmentVariable(
	  "HELIUS_MAINNET_RPC",
	);

  const issuer =
	loadRestrictedKeypairFile(
	  requireEnvironmentVariable(
		"PRIVE_ISSUER_KEYPAIR",
	  ),
	  "PRIVÉ issuer keypair",
	);

  const requestedEvidenceTtlSeconds =
	optionalPositiveInteger(
	  "PRIVE_EVIDENCE_TTL_SECONDS",
	  DEFAULT_EVIDENCE_TTL_SECONDS,
	);

  const collections =
	parsePriveCollections(
	  requireEnvironmentVariable(
		"PRIVE_COLLECTIONS",
	  ),
	);

  const config =
	loadEligibilityConfig(
	  "localnet",
	);

  const provider =
	anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  requireLocalRpcEndpoint(
	provider.connection.rpcEndpoint,
  );

  const program =
	getEligibilityProgram();

  assertProgramId(
	program.programId,
	config.eligibilityProgramId,
  );

  const programInfo =
	await provider.connection.getAccountInfo(
	  program.programId,
	  "confirmed",
	);

  requireCondition(
	programInfo !== null &&
	  programInfo.executable,
	[
	  "Program 2 is not executable on the local RPC.",
	  `Program: ${program.programId.toBase58()}`,
	].join("\n"),
  );

  const registry =
	findEligibilityRegistryPda(
	  program.programId,
	  config.realm,
	);

  const eligibilityClass =
	findEligibilityClassPda(
	  program.programId,
	  registry,
	  CLASS_ID_PRIVE_MEMBER,
	);

  const issuerGrant =
	findIssuerGrantPda(
	  program.programId,
	  registry,
	  issuer.publicKey,
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

  await requireOwnedAccount(
	provider.connection,
	issuerGrant,
	program.programId,
	"PRIVÉ issuer grant",
  );

  const registryBefore =
	await program.account
	  .eligibilityRegistry
	  .fetch(registry);

  const classAccount =
	await program.account
	  .eligibilityClass
	  .fetch(eligibilityClass);

  const issuerGrantAccount =
	await program.account
	  .issuerGrant
	  .fetch(issuerGrant);

  requireCondition(
	registryBefore.realm.equals(
	  config.realm,
	),
	"Eligibility registry Realm mismatch",
  );

  requireCondition(
	!registryBefore.paused,
	"Eligibility registry is paused",
  );

  requireCondition(
	issuerGrantAccount.version ===
	  ISSUER_GRANT_VERSION,
	"PRIVÉ issuer grant version mismatch",
  );

  requireCondition(
	issuerGrantAccount.registry.equals(
	  registry,
	),
	"PRIVÉ issuer grant registry mismatch",
  );

  requireCondition(
	issuerGrantAccount
	  .eligibilityClass
	  .equals(eligibilityClass),
	"PRIVÉ issuer grant class mismatch",
  );

  requireCondition(
	issuerGrantAccount.classId ===
	  CLASS_ID_PRIVE_MEMBER,
	"PRIVÉ issuer grant class ID mismatch",
  );

  requireCondition(
	issuerGrantAccount.issuer.equals(
	  issuer.publicKey,
	),
	"PRIVÉ issuer grant signer mismatch",
  );

  requireCondition(
	issuerGrantAccount.allowedSource ===
	  SOURCE_PRIVE_COLLECTION_VERIFIED,
	"PRIVÉ issuer grant source mismatch",
  );

  requireCondition(
	issuerGrantAccount.enabled,
	"PRIVÉ issuer grant is disabled",
  );

  const chainTimestamp =
	await currentChainTimestamp(
	  provider.connection,
	);

  requireCondition(
	issuerGrantAccount.validFromTs.lte(
	  chainTimestamp,
	),
	"PRIVÉ issuer grant is not yet valid",
  );

  requireCondition(
	issuerGrantAccount.validUntilTs.isZero() ||
	  chainTimestamp.lt(
		issuerGrantAccount.validUntilTs,
	  ),
	"PRIVÉ issuer grant has expired",
  );

  const maxEvidenceTtlSeconds =
	Number(
	  issuerGrantAccount
		.maxEvidenceTtlSeconds,
	);

  requireCondition(
	Number.isSafeInteger(
	  maxEvidenceTtlSeconds,
	) &&
	  maxEvidenceTtlSeconds > 0,
	"PRIVÉ issuer grant has an invalid maximum evidence TTL",
  );

  requireCondition(
	requestedEvidenceTtlSeconds <=
	  maxEvidenceTtlSeconds,
	[
	  "Requested PRIVÉ evidence TTL exceeds the issuer grant maximum.",
	  `Requested: ${requestedEvidenceTtlSeconds}`,
	  `Maximum:   ${maxEvidenceTtlSeconds}`,
	].join("\n"),
  );

  requireCondition(
	registryBefore.classCount === 2,
	`Expected 2 canonical v1 classes, found ${registryBefore.classCount}`,
  );

  requireCondition(
	classAccount.registry.equals(
	  registry,
	),
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
	"PRIVE_MEMBER class is disabled",
  );

  requireCondition(
	fixedBytesToString(
	  classAccount.name,
	) === "PRIVE_MEMBER",
	"PRIVE_MEMBER class name mismatch",
  );
  
  requireCondition(
	fixedBytesToString(
	  classAccount.label,
	) === "PRIVE",
	"PRIVE_MEMBER class label mismatch",
  );

  requireCondition(
	classAccount.governanceEligible,
	"PRIVE_MEMBER must be governance eligible",
  );

  requireCondition(
	classAccount.rewardsEligible,
	"PRIVE_MEMBER must be rewards eligible",
  );

  console.log(
	"Orrery: synchronize verified PRIVÉ holder",
  );

  console.log({
	ownershipReadNetwork: "mainnet",
	ownershipProvider: "Helius DAS",
	programWriteNetwork: "localnet",
	program:
	  program.programId.toBase58(),
	registry: registry.toBase58(),
	eligibilityClass:
	  eligibilityClass.toBase58(),
	feePayer:
	  provider.wallet.publicKey.toBase58(),
	issuer:
	  issuer.publicKey.toBase58(),
	issuerGrant:
	  issuerGrant.toBase58(),
	requestedEvidenceTtlSeconds,
	wallet: selection.wallet,
	walletSource: selection.source,
	expectedEligible:
	  selection.expectedEligible,
	collectionCount:
	  collections.length,
  });

  const ownership =
	await verifyPriveOwnership({
	  rpcUrl: heliusMainnetRpc,
	  wallet: selection.wallet,
	  collections,
	});

  if (
	selection.expectedEligible !== null &&
	ownership.eligible !==
	  selection.expectedEligible
  ) {
	throw new Error(
	  [
		"PRIVÉ verification produced an unexpected result.",
		`Wallet source: ${selection.source}`,
		`Expected eligible: ${selection.expectedEligible}`,
		`Actual eligible:   ${ownership.eligible}`,
	  ].join("\n"),
	);
  }

  const subjectWallet =
	new PublicKey(ownership.wallet);

  const subjectKey =
	publicKeyBytes(subjectWallet);

  const eligibilityRecord =
	findEligibilityRecordPda(
	  program.programId,
	  registry,
	  subjectKey,
	);

  const recordExists =
	await accountExists(
	  provider.connection,
	  eligibilityRecord,
	);

  let existingRecord:
	| Awaited<
		ReturnType<
		  typeof program.account.eligibilityRecord.fetch
		>
	  >
	| null = null;

  if (recordExists) {
	await requireOwnedAccount(
	  provider.connection,
	  eligibilityRecord,
	  program.programId,
	  "PRIVE_MEMBER eligibility record",
	);

	existingRecord =
	  await program.account
		.eligibilityRecord
		.fetch(eligibilityRecord);

	requireCondition(
	  existingRecord.registry.equals(
		registry,
	  ),
	  "Existing record registry mismatch",
	);

	requireCondition(
	  existingRecord
		.eligibilityClass
		.equals(eligibilityClass),
	  "Existing record class mismatch",
	);

	requireCondition(
	  existingRecord.classId ===
		CLASS_ID_PRIVE_MEMBER,
	  "Existing record class ID mismatch",
	);

	requireCondition(
	  existingRecord.subjectKind ===
		SUBJECT_KIND_WALLET,
	  "Existing record subject kind mismatch",
	);

	requireCondition(
	  bytesEqual(
		existingRecord.subjectKey,
		subjectKey,
	  ),
	  "Existing record subject key mismatch",
	);

	requireCondition(
	  existingRecord.wallet.equals(
		subjectWallet,
	  ),
	  "Existing record wallet mismatch",
	);
  }

  let expectedMetadataHash:
	| number[]
	| null = null;

  if (ownership.eligible) {
	requireCondition(
	  ownership.match !== null,
	  "Eligible ownership result is missing matching asset evidence",
	);

	expectedMetadataHash =
	  buildPriveEvidenceHash({
		wallet: ownership.wallet,
		assetId:
		  ownership.match.assetId,
		collection:
		  ownership.match.collection,
	  });
  }

  const decision =
	planPriveSync({
	  eligible: ownership.eligible,
	  existing:
		existingRecord === null
		  ? null
		  : {
			  status:
				existingRecord.status,
			  source:
				existingRecord.source,
			  metadataHash:
				Array.from(
				  existingRecord.metadataHash,
				),
			},
	  expectedMetadataHash,
	});

  console.log({
	wallet: ownership.wallet,
	eligible: ownership.eligible,
	matchedCollection:
	  ownership.match?.collection ??
	  null,
	matchedAsset:
	  ownership.match?.assetId ??
	  null,
	eligibilityRecord:
	  eligibilityRecord.toBase58(),
	recordExists,
	existingStatus:
	  existingRecord?.status ?? null,
	existingSource:
	  existingRecord?.source ?? null,
	decision: decision.action,
	shouldMutate:
	  decision.shouldMutate,
	reason: decision.reason,
  });

  if (!decision.shouldMutate) {
	const registryAfterNoOp =
	  await program.account
		.eligibilityRegistry
		.fetch(registry);

	requireCondition(
	  registryAfterNoOp.recordCount.eq(
		registryBefore.recordCount,
	  ),
	  "A no-op synchronization changed recordCount",
	);

	console.log(
	  "No Program 2 transaction submitted.",
	);

	console.log({
	  finalRecordCount:
		registryAfterNoOp
		  .recordCount
		  .toString(),
	  mutationPerformed: false,
	});

	return;
  }

  requireCondition(
	ownership.eligible,
	"Mutation requires verified PRIVÉ ownership",
  );

  requireCondition(
	ownership.match !== null,
	"Mutation requires matched ownership evidence",
  );

  requireCondition(
	expectedMetadataHash !== null,
	"Mutation requires a metadata evidence hash",
  );

  const requiredPermission =
	requiredIssuerPermission(
	  decision.action,
	);

  const configuredPermissions =
	Number(issuerGrantAccount.permissions);

  requireCondition(
	Number.isSafeInteger(
	  configuredPermissions,
	),
	"PRIVÉ issuer grant permissions are invalid",
  );

  requireCondition(
	(
	  configuredPermissions &
	  requiredPermission
	) === requiredPermission,
	[
	  "PRIVÉ issuer grant lacks the permission required by the sync decision.",
	  `Action:     ${decision.action}`,
	  `Required:   ${requiredPermission}`,
	  `Configured: ${configuredPermissions}`,
	].join("\n"),
  );

  const evidenceExpiresAt =
	chainTimestamp.add(
	  new anchor.BN(
		requestedEvidenceTtlSeconds,
	  ),
	);

  requireCondition(
	issuerGrantAccount.validUntilTs.isZero() ||
	  evidenceExpiresAt.lte(
		issuerGrantAccount.validUntilTs,
	  ),
	"PRIVÉ evidence expiry exceeds the issuer grant validity window",
  );

  const signature =
	await program.methods
	  .upsertEligibilityRecordByIssuer(
		CLASS_ID_PRIVE_MEMBER,
		SUBJECT_KIND_WALLET,
		subjectKey,
		subjectWallet,
		RECORD_STATUS_ACTIVE,
		expectedMetadataHash,
		VALID_FROM_EPOCH_ID,
		VALID_UNTIL_EPOCH_ID,
		evidenceExpiresAt,
	  )
	  .accountsStrict({
		payer:
		  provider.wallet.publicKey,
		issuer:
		  issuer.publicKey,
		registry,
		eligibilityClass,
		issuerGrant,
		eligibilityRecord,
		systemProgram:
		  SystemProgram.programId,
	  })
	  .signers([issuer])
	  .rpc();

  const finalRecord =
	await program.account
	  .eligibilityRecord
	  .fetch(eligibilityRecord);

  const finalRegistry =
	await program.account
	  .eligibilityRegistry
	  .fetch(registry);

  requireCondition(
	finalRecord.registry.equals(
	  registry,
	),
	"Final record registry mismatch",
  );

  requireCondition(
	finalRecord
	  .eligibilityClass
	  .equals(eligibilityClass),
	"Final record class mismatch",
  );

  requireCondition(
	finalRecord.wallet.equals(
	  subjectWallet,
	),
	"Final record wallet mismatch",
  );

  requireCondition(
	finalRecord.status ===
	  RECORD_STATUS_ACTIVE,
	"Final record is not Active",
  );

  requireCondition(
	finalRecord.source ===
	  SOURCE_PRIVE_COLLECTION_VERIFIED,
	"Final record source mismatch",
  );

  requireCondition(
	finalRecord.issuer.equals(
	  issuer.publicKey,
	),
	"Final record issuer mismatch",
  );

  requireCondition(
	finalRecord.evidenceExpiresAt.eq(
	  evidenceExpiresAt,
	),
	"Final record evidence expiry mismatch",
  );

  requireCondition(
	metadataHashesEqual(
	  finalRecord.metadataHash,
	  expectedMetadataHash,
	),
	"Final record evidence hash mismatch",
  );

  requireCondition(
	finalRecord.validFromEpochId ===
	  VALID_FROM_EPOCH_ID,
	"Final record validFromEpochId mismatch",
  );

  requireCondition(
	finalRecord.validUntilEpochId ===
	  VALID_UNTIL_EPOCH_ID,
	"Final record validUntilEpochId mismatch",
  );

  const expectedRecordCount =
	recordExists
	  ? registryBefore.recordCount
	  : registryBefore.recordCount.add(
		  new anchor.BN(1),
		);

  requireCondition(
	finalRegistry.recordCount.eq(
	  expectedRecordCount,
	),
	[
	  "Final registry recordCount is incorrect.",
	  `Expected: ${expectedRecordCount.toString()}`,
	  `Actual:   ${finalRegistry.recordCount.toString()}`,
	].join("\n"),
  );

  console.log(
	"Verified PRIVÉ holder synchronized successfully.",
  );

  console.log({
	action: decision.action,
	signature,
	wallet: ownership.wallet,
	eligibilityRecord:
	  eligibilityRecord.toBase58(),
	finalStatus:
	  finalRecord.status,
	finalSource:
	  finalRecord.source,
	finalRecordCount:
	  finalRegistry.recordCount.toString(),
	mutationPerformed: true,
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
