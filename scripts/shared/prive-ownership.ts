import { address } from "@solana/kit";

const DEFAULT_TIMEOUT_MS = 15_000;
const HELIUS_NO_ASSETS_ERROR_CODE = -32_004;
const SEARCH_RESULT_LIMIT = 10;

export type FetchLike = typeof globalThis.fetch;

interface JsonRpcError {
  code: number | null;
  message: string;
}

interface DasOwnership {
  owner?: unknown;
}

interface DasGrouping {
  group_key?: unknown;
  group_value?: unknown;
}

interface DasAsset {
  id?: unknown;
  interface?: unknown;
  ownership?: unknown;
  grouping?: unknown;
  burnt?: unknown;
}

interface DasSearchResult {
  items?: unknown;
}

export interface PriveOwnershipMatch {
  assetId: string;
  collection: string;
  owner: string;
  interface: string | null;
}

export interface PriveOwnershipResult {
  wallet: string;
  eligible: boolean;
  checkedCollections: string[];
  match: PriveOwnershipMatch | null;
}

export interface VerifyPriveOwnershipOptions {
  rpcUrl: string;
  wallet: string;
  collections: string[];
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value)
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

function normalizeAddress(
  label: string,
  value: string,
): string {
  const trimmed = value.trim();

  requireCondition(
	trimmed.length > 0,
	`${label} must not be empty`,
  );

  try {
	return address(trimmed);
  } catch {
	throw new Error(
	  `${label} is not a valid Solana address: ${trimmed}`,
	);
  }
}

function normalizeRpcUrl(
  value: string,
): string {
  const trimmed = value.trim();

  requireCondition(
	trimmed.length > 0,
	"HELIUS_MAINNET_RPC must not be empty",
  );

  let parsed: URL;

  try {
	parsed = new URL(trimmed);
  } catch {
	throw new Error(
	  "HELIUS_MAINNET_RPC is not a valid URL",
	);
  }

  requireCondition(
	parsed.protocol === "https:",
	"HELIUS_MAINNET_RPC must use HTTPS",
  );

  return parsed.toString();
}

function normalizeCollections(
  collections: string[],
): string[] {
  const normalized = collections.map(
	(collection, index) =>
	  normalizeAddress(
		`PRIVE_COLLECTIONS entry ${index + 1}`,
		collection,
	  ),
  );

  const unique = [...new Set(normalized)];

  requireCondition(
	unique.length > 0,
	"PRIVE_COLLECTIONS must contain at least one collection",
  );

  return unique;
}

function extractRpcError(
  payload: Record<string, unknown>,
): JsonRpcError | null {
  if (!isRecord(payload.error)) {
	return null;
  }

  const code =
	typeof payload.error.code === "number"
	  ? payload.error.code
	  : null;

  const message =
	typeof payload.error.message === "string"
	  ? payload.error.message
	  : "Unknown Helius DAS error";

  return {
	code,
	message,
  };
}

function extractSearchResult(
  payload: Record<string, unknown>,
): DasSearchResult | null {
  /*
   * Standard JSON-RPC DAS responses normally expose the
   * search container through `result`.
   */
  if (isRecord(payload.result)) {
	return payload.result;
  }

  /*
   * Helius documentation also represents the successful
   * response container as `assets`. Supporting both avoids
   * coupling the verifier to one response-envelope rendering.
   */
  if (isRecord(payload.assets)) {
	return payload.assets;
  }

  return null;
}

function extractAssets(
  result: DasSearchResult,
): DasAsset[] {
  if (!Array.isArray(result.items)) {
	throw new Error(
	  "Helius DAS search result did not contain an items array",
	);
  }

  return result.items.filter(
	(item): item is DasAsset =>
	  isRecord(item),
  );
}

function hasExactCollectionGrouping(
  grouping: unknown,
  collection: string,
): boolean {
  if (!Array.isArray(grouping)) {
	return false;
  }

  return grouping.some((entry: unknown) => {
	if (!isRecord(entry)) {
	  return false;
	}

	const candidate =
	  entry as DasGrouping;

	return (
	  candidate.group_key === "collection" &&
	  candidate.group_value === collection
	);
  });
}

function extractMatchingAsset(
  assets: DasAsset[],
  wallet: string,
  collection: string,
): PriveOwnershipMatch | null {
  for (const asset of assets) {
	if (asset.burnt === true) {
	  continue;
	}

	if (
	  typeof asset.id !== "string" ||
	  !isRecord(asset.ownership)
	) {
	  continue;
	}

	const ownership =
	  asset.ownership as DasOwnership;

	if (typeof ownership.owner !== "string") {
	  continue;
	}

	let assetId: string;
	let returnedOwner: string;

	try {
	  assetId = normalizeAddress(
		"Helius asset ID",
		asset.id,
	  );

	  returnedOwner = normalizeAddress(
		"Helius asset owner",
		ownership.owner,
	  );
	} catch {
	  continue;
	}

	if (returnedOwner !== wallet) {
	  continue;
	}

	/*
	 * Fail closed: the returned asset itself must explicitly
	 * identify the exact approved collection.
	 */
	if (
	  !hasExactCollectionGrouping(
		asset.grouping,
		collection,
	  )
	) {
	  continue;
	}

	return {
	  assetId,
	  collection,
	  owner: returnedOwner,
	  interface:
		typeof asset.interface === "string"
		  ? asset.interface
		  : null,
	};
  }

  return null;
}

function isAbortError(
  error: unknown,
): boolean {
  return (
	isRecord(error) &&
	error.name === "AbortError"
  );
}

async function readJsonResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const rawBody = await response.text();

  let parsed: unknown;

  try {
	parsed = JSON.parse(rawBody);
  } catch {
	throw new Error(
	  [
		"Helius DAS returned invalid JSON.",
		`HTTP status: ${response.status}`,
	  ].join("\n"),
	);
  }

  if (!isRecord(parsed)) {
	throw new Error(
	  "Helius DAS returned an invalid response envelope",
	);
  }

  return parsed;
}

async function searchCollection(
  rpcUrl: string,
  wallet: string,
  collection: string,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<PriveOwnershipMatch | null> {
  const controller =
	new AbortController();

  const timeout = setTimeout(
	() => controller.abort(),
	timeoutMs,
  );

  try {
	const response = await fetchImpl(
	  rpcUrl,
	  {
		method: "POST",
		headers: {
		  "Content-Type":
			"application/json",
		},
		signal: controller.signal,
		body: JSON.stringify({
		  jsonrpc: "2.0",
		  id: `physis-prive-${collection.slice(0, 8)}`,
		  method: "searchAssets",
		  params: {
			ownerAddress: wallet,
			tokenType: "nonFungible",
			grouping: [
			  "collection",
			  collection,
			],
			burnt: false,
			page: 1,
			limit: SEARCH_RESULT_LIMIT,
			options: {
			  /*
			   * Program policy trusts the explicit DAO
			   * collection allowlist. It does not rely on
			   * Helius assigning its own verified flag to
			   * every legacy Foundry collection.
			   */
			  showUnverifiedCollections: true,
			  showCollectionMetadata: false,
			  showGrandTotal: false,
			  showNativeBalance: false,
			  showZeroBalance: false,
			},
		  },
		}),
	  },
	);

	const payload =
	  await readJsonResponse(response);

	const rpcError =
	  extractRpcError(payload);

	if (rpcError !== null) {
	  if (
		rpcError.code ===
		HELIUS_NO_ASSETS_ERROR_CODE
	  ) {
		return null;
	  }

	  throw new Error(
		[
		  "Helius DAS request failed.",
		  `Code: ${rpcError.code ?? "unknown"}`,
		  `Message: ${rpcError.message}`,
		].join("\n"),
	  );
	}

	if (!response.ok) {
	  throw new Error(
		`Helius DAS HTTP request failed with status ${response.status}`,
	  );
	}

	const result =
	  extractSearchResult(payload);

	if (result === null) {
	  throw new Error(
		"Helius DAS response did not contain a search result",
	  );
	}

	return extractMatchingAsset(
	  extractAssets(result),
	  wallet,
	  collection,
	);
  } catch (error: unknown) {
	if (isAbortError(error)) {
	  throw new Error(
		`Helius DAS request timed out after ${timeoutMs} ms`,
	  );
	}

	throw error;
  } finally {
	clearTimeout(timeout);
  }
}

export function parsePriveCollections(
  value: string,
): string[] {
  return normalizeCollections(
	value
	  .split(",")
	  .map((entry) => entry.trim())
	  .filter(
		(entry) => entry.length > 0,
	  ),
  );
}

export async function verifyPriveOwnership(
  options: VerifyPriveOwnershipOptions,
): Promise<PriveOwnershipResult> {
  const rpcUrl =
	normalizeRpcUrl(options.rpcUrl);

  const wallet =
	normalizeAddress(
	  "Wallet",
	  options.wallet,
	);

  const collections =
	normalizeCollections(
	  options.collections,
	);

  const timeoutMs =
	options.timeoutMs ??
	DEFAULT_TIMEOUT_MS;

  requireCondition(
	Number.isSafeInteger(timeoutMs) &&
	  timeoutMs > 0,
	"timeoutMs must be a positive safe integer",
  );

  const fetchImpl =
	options.fetchImpl ??
	globalThis.fetch;

  requireCondition(
	typeof fetchImpl === "function",
	"A Fetch API implementation is required",
  );

  for (const collection of collections) {
	const match =
	  await searchCollection(
		rpcUrl,
		wallet,
		collection,
		timeoutMs,
		fetchImpl,
	  );

	if (match !== null) {
	  return {
		wallet,
		eligible: true,
		checkedCollections:
		  collections,
		match,
	  };
	}
  }

  return {
	wallet,
	eligible: false,
	checkedCollections: collections,
	match: null,
  };
}
