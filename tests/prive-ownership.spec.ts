import { strict as assert } from "node:assert";

import {
  parsePriveCollections,
  verifyPriveOwnership,
  type FetchLike,
} from "../scripts/shared/prive-ownership.ts";

const TEST_OWNER =
  "wfSXjyiLAv2mmCyPBhgT5ZNaPtAenNjQ6jaanQpdJJm";

const OTHER_OWNER =
  "6ZuPrCK472jw3ZjRBqa6PZQ1tyVvY5BuYfWS7GMq7hX8";

const COLLECTION_A =
  "HmnWH4u6nyUx7WfZrb1Taejcu3H1vmca7jbAMap2SNvK";

const COLLECTION_B =
  "BvGrvq4xRqTnan7djgLvSjDWrLz8KRiCFsqkty6FuYZ3";

const COLLECTION_C =
  "3Av8Fz5vHvRwq9uvfBtEoYEBmrYJe5nnLq72fJUA7wT8";

const TEST_ASSET_ID =
  "EmPP7ZqgyHyjmFoDPh1zhreTsi3RhaYW5TTG1y158ijc";

const RPC_URL =
  "https://mainnet.helius-rpc.com/?api-key=test-key";

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
	JSON.stringify(body),
	{
	  status,
	  headers: {
		"Content-Type":
		  "application/json",
	  },
	},
  );
}

function noAssetsResponse(): Response {
  return jsonResponse({
	jsonrpc: "2.0",
	id: "test",
	error: {
	  code: -32_004,
	  message:
		"No assets found matching the search criteria.",
	},
  });
}

function emptyResultResponse(): Response {
  return jsonResponse({
	jsonrpc: "2.0",
	id: "test",
	result: {
	  total: 0,
	  limit: 10,
	  page: 1,
	  items: [],
	},
  });
}

function matchResponse(
  options: {
	owner?: string;
	collection?: string;
	burnt?: boolean;
	envelope?: "result" | "assets";
  } = {},
): Response {
  const owner =
	options.owner ??
	TEST_OWNER;

  const collection =
	options.collection ??
	COLLECTION_B;

  const burnt =
	options.burnt ??
	false;

  const envelope =
	options.envelope ??
	"result";

  const result = {
	total: 1,
	limit: 10,
	page: 1,
	items: [
	  {
		interface: "V1_NFT",
		id: TEST_ASSET_ID,
		ownership: {
		  owner,
		  ownership_model: "single",
		},
		grouping: [
		  {
			group_key: "collection",
			group_value: collection,
		  },
		],
		burnt,
	  },
	],
  };

  return jsonResponse({
	jsonrpc: "2.0",
	id: "test",
	[envelope]: result,
  });
}

describe(
  "PRIVÉ ownership verifier",
  () => {
	it(
	  "finds an approved asset in the second configured collection",
	  async () => {
		const requests: Array<
		  Record<string, unknown>
		> = [];

		const fetchImpl: FetchLike =
		  async (
			_input,
			init,
		  ): Promise<Response> => {
			const body = init?.body;
			
			if (typeof body !== "string") {
			  throw new Error(
				"Expected the Helius request body to be a JSON string",
			  );
			}
			
			const request =
			  JSON.parse(body) as Record<
				string,
				unknown
			  >;

			requests.push(request);

			return requests.length === 1
			  ? noAssetsResponse()
			  : matchResponse({
				  collection:
					COLLECTION_B,
				  envelope: "assets",
				});
		  };

		const result =
		  await verifyPriveOwnership({
			rpcUrl: RPC_URL,
			wallet: TEST_OWNER,
			collections: [
			  COLLECTION_A,
			  COLLECTION_B,
			  COLLECTION_C,
			],
			fetchImpl,
		  });

		assert.equal(
		  requests.length,
		  2,
		);

		assert.equal(
		  result.eligible,
		  true,
		);

		assert.equal(
		  result.match?.assetId,
		  TEST_ASSET_ID,
		);

		assert.equal(
		  result.match?.collection,
		  COLLECTION_B,
		);

		assert.equal(
		  result.match?.owner,
		  TEST_OWNER,
		);

		const secondParams =
		  requests[1]?.params as
			| Record<string, unknown>
			| undefined;

		assert.deepEqual(
		  secondParams?.grouping,
		  [
			"collection",
			COLLECTION_B,
		  ],
		);

		assert.equal(
		  secondParams?.ownerAddress,
		  TEST_OWNER,
		);

		assert.equal(
		  secondParams?.tokenType,
		  "nonFungible",
		);

		assert.equal(
		  secondParams?.burnt,
		  false,
		);
	  },
	);

	it(
	  "returns ineligible when every approved collection is empty",
	  async () => {
		let requestCount = 0;

		const fetchImpl: FetchLike =
		  async (): Promise<Response> => {
			requestCount += 1;

			return emptyResultResponse();
		  };

		const result =
		  await verifyPriveOwnership({
			rpcUrl: RPC_URL,
			wallet: TEST_OWNER,
			collections: [
			  COLLECTION_A,
			  COLLECTION_B,
			  COLLECTION_C,
			],
			fetchImpl,
		  });

		assert.equal(
		  requestCount,
		  3,
		);

		assert.equal(
		  result.eligible,
		  false,
		);

		assert.equal(
		  result.match,
		  null,
		);
	  },
	);

	it(
	  "rejects an asset returned for a different owner",
	  async () => {
		const fetchImpl: FetchLike =
		  async (): Promise<Response> =>
			matchResponse({
			  owner: OTHER_OWNER,
			  collection:
				COLLECTION_A,
			});

		const result =
		  await verifyPriveOwnership({
			rpcUrl: RPC_URL,
			wallet: TEST_OWNER,
			collections: [
			  COLLECTION_A,
			],
			fetchImpl,
		  });

		assert.equal(
		  result.eligible,
		  false,
		);

		assert.equal(
		  result.match,
		  null,
		);
	  },
	);

	it(
	  "rejects an asset whose returned collection grouping does not match",
	  async () => {
		const fetchImpl: FetchLike =
		  async (): Promise<Response> =>
			matchResponse({
			  owner: TEST_OWNER,
			  collection:
				COLLECTION_B,
			});

		const result =
		  await verifyPriveOwnership({
			rpcUrl: RPC_URL,
			wallet: TEST_OWNER,
			collections: [
			  COLLECTION_A,
			],
			fetchImpl,
		  });

		assert.equal(
		  result.eligible,
		  false,
		);

		assert.equal(
		  result.match,
		  null,
		);
	  },
	);

	it(
	  "rejects a burned approved asset",
	  async () => {
		const fetchImpl: FetchLike =
		  async (): Promise<Response> =>
			matchResponse({
			  collection:
				COLLECTION_A,
			  burnt: true,
			});

		const result =
		  await verifyPriveOwnership({
			rpcUrl: RPC_URL,
			wallet: TEST_OWNER,
			collections: [
			  COLLECTION_A,
			],
			fetchImpl,
		  });

		assert.equal(
		  result.eligible,
		  false,
		);

		assert.equal(
		  result.match,
		  null,
		);
	  },
	);

	it(
	  "propagates Helius authentication failures",
	  async () => {
		const fetchImpl: FetchLike =
		  async (): Promise<Response> =>
			jsonResponse({
			  jsonrpc: "2.0",
			  id: "test",
			  error: {
				code: -32_001,
				message:
				  "Authentication failed. Missing or invalid API key.",
			  },
			});

		await assert.rejects(
		  verifyPriveOwnership({
			rpcUrl: RPC_URL,
			wallet: TEST_OWNER,
			collections: [
			  COLLECTION_A,
			],
			fetchImpl,
		  }),
		  /Authentication failed/,
		);
	  },
	);

	it(
	  "normalizes and deduplicates the real collection configuration",
	  () => {
		const parsed =
		  parsePriveCollections(
			[
			  COLLECTION_A,
			  COLLECTION_B,
			  COLLECTION_C,
			  COLLECTION_A,
			].join(","),
		  );

		assert.deepEqual(
		  parsed,
		  [
			COLLECTION_A,
			COLLECTION_B,
			COLLECTION_C,
		  ],
		);
	  },
	);

	it(
	  "rejects an invalid configured collection address",
	  () => {
		assert.throws(
		  () =>
			parsePriveCollections(
			  `${COLLECTION_A},not-a-solana-address`,
			),
		  /not a valid Solana address/,
		);
	  },
	);
  },
);
