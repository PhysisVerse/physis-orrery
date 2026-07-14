import {
  parsePriveCollections,
  verifyPriveOwnership,
} from "../shared/prive-ownership.ts";

interface WalletSelection {
  wallet: string;
  source:
	| "PRIVE_TEST_HOLDER"
	| "PRIVE_TEST_NON_HOLDER"
	| "command-line argument";
  expectedEligible:
	| boolean
	| null;
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

function resolveWalletSelection(): WalletSelection {
  const args = process.argv.slice(2);

  if (args.length > 1) {
	throw new Error(
	  [
		"Too many command-line arguments.",
		"",
		"Usage:",
		"  verify-prive-ownership.ts",
		"  verify-prive-ownership.ts --holder",
		"  verify-prive-ownership.ts --non-holder",
		"  verify-prive-ownership.ts <WALLET>",
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

async function main(): Promise<void> {
  const selection =
	resolveWalletSelection();

  const rpcUrl =
	requireEnvironmentVariable(
	  "HELIUS_MAINNET_RPC",
	);

  const collections =
	parsePriveCollections(
	  requireEnvironmentVariable(
		"PRIVE_COLLECTIONS",
	  ),
	);

  console.log(
	"Orrery: read-only PRIVÉ ownership verification",
  );

  console.log({
	wallet: selection.wallet,
	walletSource: selection.source,
	expectedEligible:
	  selection.expectedEligible,
	collectionCount:
	  collections.length,
	approvedCollections:
	  collections,
	network: "mainnet",
	provider: "Helius DAS",
	mutationPerformed: false,
  });

  const result =
	await verifyPriveOwnership({
	  rpcUrl,
	  wallet: selection.wallet,
	  collections,
	});

  console.log({
	wallet: result.wallet,
	eligible: result.eligible,
	matchedCollection:
	  result.match?.collection ??
	  null,
	matchedAsset:
	  result.match?.assetId ??
	  null,
	assetInterface:
	  result.match?.interface ??
	  null,
	mutationPerformed: false,
  });

  if (
	selection.expectedEligible !== null &&
	result.eligible !==
	  selection.expectedEligible
  ) {
	throw new Error(
	  [
		"PRIVÉ verification produced an unexpected result.",
		`Wallet source: ${selection.source}`,
		`Expected eligible: ${selection.expectedEligible}`,
		`Actual eligible:   ${result.eligible}`,
	  ].join("\n"),
	);
  }

  if (result.eligible) {
	console.log(
	  "PRIVÉ ownership verified.",
	);
  } else {
	console.log(
	  "No approved PRIVÉ asset is currently owned by this wallet.",
	);
  }

  if (
	selection.expectedEligible !== null
  ) {
	console.log(
	  "Expected ownership result confirmed.",
	);
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
