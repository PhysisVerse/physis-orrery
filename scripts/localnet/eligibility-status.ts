import * as anchor from "@anchor-lang/core";

import {
  CLASS_ID_PERSONA_VERIFIED,
  CLASS_ID_PRIVE_MEMBER,
  accountExists,
  assertProgramId,
  findEligibilityClassPda,
  findEligibilityRegistryPda,
  fixedBytesToString,
  getEligibilityProgram,
  loadEligibilityConfig,
  requireOwnedAccount,
} from "../shared/eligibility.ts";

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

  const account =
	await program.account.eligibilityRegistry.fetch(
	  registry,
	);

  console.log(
	"Orrery: Physis Eligibility Registry status",
  );

  console.log({
	cluster: config.cluster,
	program: program.programId.toBase58(),
	registry: registry.toBase58(),
	realm: account.realm.toBase58(),
	authority: account.authority.toBase58(),
	epochRegistry:
	  account.epochRegistry.toBase58(),
	governanceMode: account.governanceMode,
	paused: account.paused,
	classCount: account.classCount,
	recordCount: account.recordCount.toString(),
	createdTs: account.createdTs.toString(),
	updatedTs: account.updatedTs.toString(),
  });

  for (
	const classId of [
	  CLASS_ID_PRIVE_MEMBER,
	  CLASS_ID_PERSONA_VERIFIED,
	]
  ) {
	const eligibilityClass =
	  findEligibilityClassPda(
		program.programId,
		registry,
		classId,
	  );

	const exists = await accountExists(
	  provider.connection,
	  eligibilityClass,
	);

	if (!exists) {
	  console.log({
		classId,
		address: eligibilityClass.toBase58(),
		exists: false,
	  });

	  continue;
	}

	await requireOwnedAccount(
	  provider.connection,
	  eligibilityClass,
	  program.programId,
	  `Eligibility class ${classId}`,
	);

	const classAccount =
	  await program.account.eligibilityClass.fetch(
		eligibilityClass,
	  );

	console.log({
	  classId: classAccount.classId,
	  address: eligibilityClass.toBase58(),
	  exists: true,
	  name: fixedBytesToString(
		classAccount.name,
	  ),
	  label: fixedBytesToString(
		classAccount.label,
	  ),
	  kind: classAccount.kind,
	  status: classAccount.status,
	  enabled: classAccount.enabled,
	  governanceEligible:
		classAccount.governanceEligible,
	  rewardsEligible:
		classAccount.rewardsEligible,
	  gateMint:
		classAccount.gateMint.toBase58(),
	  minAmount:
		classAccount.minAmount.toString(),
	  validFromEpochId:
		classAccount.validFromEpochId,
	  validUntilEpochId:
		classAccount.validUntilEpochId,
	});
  }
}

main().catch((error: unknown) => {
  console.error(
	error instanceof Error
	  ? error.message
	  : error,
  );

  process.exit(1);
});
