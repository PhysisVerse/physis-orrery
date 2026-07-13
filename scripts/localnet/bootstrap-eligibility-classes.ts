import * as anchor from "@anchor-lang/core";
import {
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

import {
  CLASS_ID_PERSONA_VERIFIED,
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PERSONA_VERIFIED,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  LABEL_BYTES,
  NAME_BYTES,
  accountExists,
  assertProgramId,
  findEligibilityClassPda,
  findEligibilityRegistryPda,
  fixedBytes,
  fixedBytesEqual,
  getEligibilityProgram,
  loadEligibilityConfig,
  requireOwnedAccount,
} from "../shared/eligibility.ts";

type ClassDefinition = {
  classId: number;
  name: string;
  label: string;
  kind: number;
  governanceEligible: boolean;
  rewardsEligible: boolean;
};

const CLASS_DEFINITIONS: ClassDefinition[] = [
  {
	classId: CLASS_ID_PRIVE_MEMBER,
	name: "PRIVE_MEMBER",
	label: "PRIVE",
	kind: CLASS_KIND_PRIVE_MEMBER,
	governanceEligible: true,
	rewardsEligible: true,
  },
  {
	classId: CLASS_ID_PERSONA_VERIFIED,
	name: "PERSONA_VERIFIED",
	label: "PERSONA",
	kind: CLASS_KIND_PERSONA_VERIFIED,
	governanceEligible: false,
	rewardsEligible: false,
  },
];

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

  await requireOwnedAccount(
	provider.connection,
	registry,
	program.programId,
	"Program 2 eligibility registry",
  );

  const registryAccount =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  if (!registryAccount.realm.equals(config.realm)) {
	throw new Error(
	  "Eligibility registry Realm mismatch",
	);
  }

  if (registryAccount.paused) {
	throw new Error(
	  "Eligibility registry is paused; refusing class bootstrap",
	);
  }

  if (
	!registryAccount.authority.equals(
	  provider.wallet.publicKey,
	)
  ) {
	throw new Error(
	  [
		"Connected wallet is not the registry authority.",
		`Expected: ${registryAccount.authority.toBase58()}`,
		`Actual:   ${provider.wallet.publicKey.toBase58()}`,
	  ].join("\n"),
	);
  }

  console.log(
	"Orrery: bootstrap Program 2 genesis classes",
  );
  console.log("Cluster:", config.cluster);
  console.log(
	"Program:",
	program.programId.toBase58(),
  );
  console.log("Registry:", registry.toBase58());
  console.log(
	"Authority:",
	provider.wallet.publicKey.toBase58(),
  );

  for (const definition of CLASS_DEFINITIONS) {
	const eligibilityClass =
	  findEligibilityClassPda(
		program.programId,
		registry,
		definition.classId,
	  );

	const exists = await accountExists(
	  provider.connection,
	  eligibilityClass,
	);

	const expectedName = fixedBytes(
	  definition.name,
	  NAME_BYTES,
	);

	const expectedLabel = fixedBytes(
	  definition.label,
	  LABEL_BYTES,
	);

	if (exists) {
	  await requireOwnedAccount(
		provider.connection,
		eligibilityClass,
		program.programId,
		`Eligibility class ${definition.classId}`,
	  );

	  const existing =
		await program.account.eligibilityClass.fetch(
		  eligibilityClass,
		);

	  const mismatches: string[] = [];

	  if (!existing.registry.equals(registry)) {
		mismatches.push("registry");
	  }

	  if (
		existing.classId !== definition.classId
	  ) {
		mismatches.push("classId");
	  }

	  if (
		!fixedBytesEqual(
		  existing.name,
		  expectedName,
		)
	  ) {
		mismatches.push("name");
	  }

	  if (
		!fixedBytesEqual(
		  existing.label,
		  expectedLabel,
		)
	  ) {
		mismatches.push("label");
	  }

	  if (existing.kind !== definition.kind) {
		mismatches.push("kind");
	  }

	  if (
		existing.status !== CLASS_STATUS_ACTIVE
	  ) {
		mismatches.push("status");
	  }

	  if (!existing.enabled) {
		mismatches.push("enabled");
	  }

	  if (
		existing.governanceEligible !==
		definition.governanceEligible
	  ) {
		mismatches.push("governanceEligible");
	  }

	  if (
		existing.rewardsEligible !==
		definition.rewardsEligible
	  ) {
		mismatches.push("rewardsEligible");
	  }

	  if (
		!existing.gateMint.equals(
		  PublicKey.default,
		)
	  ) {
		mismatches.push("gateMint");
	  }

	  if (!existing.minAmount.eq(new anchor.BN(0))) {
		mismatches.push("minAmount");
	  }

	  if (existing.validFromEpochId !== 0) {
		mismatches.push("validFromEpochId");
	  }

	  if (existing.validUntilEpochId !== 0) {
		mismatches.push("validUntilEpochId");
	  }

	  if (mismatches.length > 0) {
		throw new Error(
		  [
			`Existing class ${definition.classId} does not match the canonical v1 definition.`,
			`Address: ${eligibilityClass.toBase58()}`,
			`Mismatched fields: ${mismatches.join(", ")}`,
			"Refusing to overwrite existing class state.",
		  ].join("\n"),
		);
	  }

	  console.log(
		`Class ${definition.classId} already exists and is canonical:`,
		eligibilityClass.toBase58(),
	  );

	  continue;
	}

	const signature = await program.methods
	  .upsertEligibilityClass(
		definition.classId,
		expectedName,
		expectedLabel,
		definition.kind,
		CLASS_STATUS_ACTIVE,
		true,
		definition.governanceEligible,
		definition.rewardsEligible,
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
		systemProgram: SystemProgram.programId,
	  })
	  .rpc();

	console.log(
	  `Created class ${definition.classId}:`,
	  eligibilityClass.toBase58(),
	);
	console.log("Signature:", signature);
  }

  const finalRegistry =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  if (finalRegistry.classCount !== 2) {
	throw new Error(
	  `Expected exactly 2 v1 classes, found ${finalRegistry.classCount}`,
	);
  }

  console.log(
	"Genesis class bootstrap complete and verified.",
  );
}

main().catch((error: unknown) => {
  console.error(
	error instanceof Error
	  ? error.message
	  : error,
  );

  process.exit(1);
});
