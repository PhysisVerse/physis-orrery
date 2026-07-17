import * as anchor from "@anchor-lang/core";
import {
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import assert from "assert";

import {
  AUTH_KIND_DELEGATED_ISSUER,
  CLASS_ID_PRIVE_MEMBER,
  ELIGIBILITY_PROGRAM_ID,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
  ISSUER_PERMISSION_ACTIVATE_PENDING,
  ISSUER_PERMISSION_ALL,
  ISSUER_PERMISSION_CREATE,
  ISSUER_PERMISSION_REFRESH,
  METADATA_HASH_BYTES,
  RECORD_STATUS_ACTIVE,
  RECORD_STATUS_PENDING,
  RECORD_STATUS_REVOKED,
  RECORD_STATUS_SUSPENDED,
  SUBJECT_KIND_WALLET,
} from "./helpers/eligibility-constants.ts";

import {
  findEligibilityRecordPda,
} from "./helpers/eligibility-pdas.ts";

import {
  createPriveFixture,
  disablePriveIssuerGrant,
  metadataHash,
  nowUnixSeconds,
  program,
  provider,
  pubkeyBytes,
  revokePriveRecord,
  suspendPriveRecord,
  upsertPriveDaoOverride,
  upsertPriveIssuerGrant,
  upsertPriveRecordByIssuer,
  zeroBytes,
} from "./helpers/eligibility-record-fixture.ts";

type ParsedEvent = {
  name: string;
  data: Record<string, unknown>;
};

describe(
  "physis_eligibility_registry delegated record upsert",
  () => {
    assert.strictEqual(
      program.programId.toBase58(),
      ELIGIBILITY_PROGRAM_ID,
    );

    function eventField<T>(
      data: Record<string, unknown>,
      camelCaseName: string,
      snakeCaseName?: string,
    ): T {
      if (camelCaseName in data) {
        return data[camelCaseName] as T;
      }

      if (
        snakeCaseName &&
        snakeCaseName in data
      ) {
        return data[snakeCaseName] as T;
      }

      assert.fail(
        `Missing event field: ${camelCaseName}`,
      );
    }

    function asPublicKey(
      value: unknown,
    ): PublicKey {
      assert.ok(
        value instanceof PublicKey,
        "Expected decoded event field to be a PublicKey",
      );

      return value;
    }

    async function loadEvents(
      signature: string,
    ): Promise<ParsedEvent[]> {
      let logs: string[] | null = null;

      for (
        let attempt = 0;
        attempt < 10;
        attempt += 1
      ) {
        const transaction =
          await provider.connection
            .getTransaction(signature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });

        logs =
          transaction?.meta
            ?.logMessages ?? null;

        if (logs) {
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 50),
        );
      }

      assert.notStrictEqual(
        logs,
        null,
        `Transaction logs were unavailable for ${signature}`,
      );

      const parser =
        new anchor.EventParser(
          program.programId,
          program.coder,
        );

      return Array.from(
        parser.parseLogs(logs!),
      ).map((event) => ({
        name: event.name,
        data:
          event.data as Record<
            string,
            unknown
          >,
      }));
    }

    async function expectEvent(
      signature: string,
      expectedName: string,
    ): Promise<Record<string, unknown>> {
      const events =
        await loadEvents(signature);

      const event = events.find(
        (candidate) =>
          candidate.name.toLowerCase() ===
          expectedName.toLowerCase(),
      );

      assert.ok(
        event,
        `Expected ${expectedName}; decoded events: ${events
          .map(
            (candidate) =>
              candidate.name,
          )
          .join(", ")}`,
      );

      return event.data;
    }

    async function expectAnchorError(
      promiseFactory:
        () => Promise<unknown>,
      expectedCode: string,
    ): Promise<void> {
      try {
        await promiseFactory();
      } catch (error: unknown) {
        const code = (
          error as {
            error?: {
              errorCode?: {
                code?: string;
              };
            };
          }
        ).error?.errorCode?.code;

        assert.strictEqual(
          code,
          expectedCode,
          `Expected Anchor error ${expectedCode}, received ${code}`,
        );

        return;
      }

      assert.fail(
        `Expected Anchor error ${expectedCode}, but transaction succeeded`,
      );
    }

    it(
      "creates an Active record from an authenticated issuer",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        const expiresAt =
          nowUnixSeconds() + 300;

        const evidence =
          metadataHash(101);

        const {
          signature,
          wallet,
          eligibilityRecord,
        } =
          await upsertPriveRecordByIssuer({
            ...fixture,
            issuer,
            metadataHash: evidence,
            evidenceExpiresAt:
              expiresAt,
          });

        const account =
          await program.account
            .eligibilityRecord
            .fetch(eligibilityRecord);

        const registryAccount =
          await program.account
            .eligibilityRegistry
            .fetch(fixture.registry);

        assert.strictEqual(
          registryAccount.recordCount
            .toNumber(),
          1,
        );

        assert.strictEqual(
          account.wallet.toBase58(),
          wallet.toBase58(),
        );

        assert.strictEqual(
          account.status,
          RECORD_STATUS_ACTIVE,
        );

        assert.strictEqual(
          account.source,
          ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
        );

        assert.strictEqual(
          account.issuer.toBase58(),
          issuer.publicKey.toBase58(),
        );

        assert.deepStrictEqual(
          account.metadataHash,
          evidence,
        );

        assert.ok(
          account.evidenceIssuedAt
            .toNumber() > 0,
        );

        assert.strictEqual(
          account.evidenceExpiresAt
            .toNumber(),
          expiresAt,
        );

        const event =
          await expectEvent(
            signature,
            "EligibilityRecordUpserted",
          );

        assert.strictEqual(
          asPublicKey(
            eventField(
              event,
              "issuer",
            ),
          ).toBase58(),
          issuer.publicKey.toBase58(),
        );

        assert.strictEqual(
          eventField<number>(
            event,
            "authKind",
            "auth_kind",
          ),
          AUTH_KIND_DELEGATED_ISSUER,
        );

        assert.deepStrictEqual(
          Array.from(
            eventField<
              number[] | Uint8Array
            >(
              event,
              "metadataHash",
              "metadata_hash",
            ),
          ),
          evidence,
        );

        assert.strictEqual(
          eventField<anchor.BN>(
            event,
            "evidenceExpiresAt",
            "evidence_expires_at",
          ).toNumber(),
          expiresAt,
        );
      },
    );

    it(
      "creates a Pending record with CREATE permission",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        const { eligibilityRecord } =
          await upsertPriveRecordByIssuer({
            ...fixture,
            issuer,
            status:
              RECORD_STATUS_PENDING,
          });

        const account =
          await program.account
            .eligibilityRecord
            .fetch(eligibilityRecord);

        assert.strictEqual(
          account.status,
          RECORD_STATUS_PENDING,
        );
      },
    );

    it(
      "allows a rotated issuer with REFRESH permission",
      async () => {
        const fixture =
          await createPriveFixture();

        const firstIssuer =
          Keypair.generate();

        const secondIssuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer:
            firstIssuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer:
            secondIssuer.publicKey,
          permissions:
            ISSUER_PERMISSION_REFRESH,
        });

        const wallet =
          Keypair.generate().publicKey;

        const created =
          await upsertPriveRecordByIssuer({
            ...fixture,
            issuer: firstIssuer,
            wallet,
            metadataHash:
              metadataHash(201),
          });

        await upsertPriveRecordByIssuer({
          ...fixture,
          issuer: secondIssuer,
          wallet,
          metadataHash:
            metadataHash(202),
        });

        const account =
          await program.account
            .eligibilityRecord
            .fetch(
              created.eligibilityRecord,
            );

        const registryAccount =
          await program.account
            .eligibilityRegistry
            .fetch(fixture.registry);

        assert.strictEqual(
          registryAccount.recordCount
            .toNumber(),
          1,
        );

        assert.strictEqual(
          account.issuer.toBase58(),
          secondIssuer.publicKey
            .toBase58(),
        );

        assert.deepStrictEqual(
          account.metadataHash,
          metadataHash(202),
        );
      },
    );

    it(
      "activates Pending only with ACTIVATE_PENDING permission",
      async () => {
        const fixture =
          await createPriveFixture();

        const creator =
          Keypair.generate();

        const activator =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer:
            creator.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer:
            activator.publicKey,
          permissions:
            ISSUER_PERMISSION_ACTIVATE_PENDING,
        });

        const wallet =
          Keypair.generate().publicKey;

        const created =
          await upsertPriveRecordByIssuer({
            ...fixture,
            issuer: creator,
            wallet,
            status:
              RECORD_STATUS_PENDING,
          });

        await upsertPriveRecordByIssuer({
          ...fixture,
          issuer: activator,
          wallet,
          status:
            RECORD_STATUS_ACTIVE,
          metadataHash:
            metadataHash(302),
        });

        const account =
          await program.account
            .eligibilityRecord
            .fetch(
              created.eligibilityRecord,
            );

        assert.strictEqual(
          account.status,
          RECORD_STATUS_ACTIVE,
        );

        assert.strictEqual(
          account.issuer.toBase58(),
          activator.publicKey
            .toBase58(),
        );
      },
    );

    it(
      "refreshes Pending with REFRESH permission",
      async () => {
        const fixture =
          await createPriveFixture();

        const creator =
          Keypair.generate();

        const refresher =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer:
            creator.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer:
            refresher.publicKey,
          permissions:
            ISSUER_PERMISSION_REFRESH,
        });

        const wallet =
          Keypair.generate().publicKey;

        const created =
          await upsertPriveRecordByIssuer({
            ...fixture,
            issuer: creator,
            wallet,
            status:
              RECORD_STATUS_PENDING,
          });

        await upsertPriveRecordByIssuer({
          ...fixture,
          issuer: refresher,
          wallet,
          status:
            RECORD_STATUS_PENDING,
          metadataHash:
            metadataHash(402),
        });

        const account =
          await program.account
            .eligibilityRecord
            .fetch(
              created.eligibilityRecord,
            );

        assert.strictEqual(
          account.status,
          RECORD_STATUS_PENDING,
        );

        assert.strictEqual(
          account.issuer.toBase58(),
          refresher.publicKey
            .toBase58(),
        );
      },
    );

    it(
      "rejects creation without CREATE permission",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_REFRESH,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
            }),
          "IssuerPermissionDenied",
        );
      },
    );

    it(
      "rejects Active to Pending regression",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_ALL,
        });

        const wallet =
          Keypair.generate().publicKey;

        await upsertPriveRecordByIssuer({
          ...fixture,
          issuer,
          wallet,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              wallet,
              status:
                RECORD_STATUS_PENDING,
            }),
          "DelegatedRecordTransitionNotAllowed",
        );
      },
    );

    it(
      "rejects a disabled issuer grant",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        await disablePriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
            }),
          "IssuerGrantDisabled",
        );
      },
    );

    it(
      "rejects a grant before its validity window",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        const now =
          nowUnixSeconds();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
          validFromTs: now + 3600,
          validUntilTs: now + 7200,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              evidenceExpiresAt:
                now + 4000,
            }),
          "IssuerGrantNotYetValid",
        );
      },
    );

    it(
      "rejects an expired grant",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        const now =
          nowUnixSeconds();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
          validFromTs: 0,
          validUntilTs: now - 1,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
            }),
          "IssuerGrantExpired",
        );
      },
    );

    it(
      "rejects an all-zero evidence hash",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              metadataHash:
                zeroBytes(
                  METADATA_HASH_BYTES,
                ),
            }),
          "InvalidMetadataHash",
        );
      },
    );

    it(
      "rejects a nonfuture evidence expiry",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              evidenceExpiresAt:
                nowUnixSeconds() - 1,
            }),
          "InvalidEvidenceExpiry",
        );
      },
    );

    it(
      "rejects expiry beyond the grant TTL",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
          maxEvidenceTtlSeconds: 60,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              evidenceExpiresAt:
                nowUnixSeconds() + 300,
            }),
          "EvidenceExpiryExceedsGrantTtl",
        );
      },
    );

    it(
      "rejects expiry beyond grant validity",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        const now =
          nowUnixSeconds();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
          maxEvidenceTtlSeconds: 7200,
          validUntilTs: now + 600,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              evidenceExpiresAt:
                now + 601,
            }),
          "EvidenceExpiryExceedsGrantValidity",
        );
      },
    );

    it(
      "rejects overwriting a DAO override record",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_REFRESH,
        });

        const wallet =
          Keypair.generate().publicKey;

        await upsertPriveDaoOverride({
          ...fixture,
          wallet,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              wallet,
            }),
          "DelegatedCannotOverwriteDaoOverride",
        );
      },
    );

    it(
      "rejects refreshing a Suspended record",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_ALL,
        });

        const wallet =
          Keypair.generate().publicKey;

        await upsertPriveRecordByIssuer({
          ...fixture,
          issuer,
          wallet,
        });

        await suspendPriveRecord({
          ...fixture,
          wallet,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              wallet,
            }),
          "DelegatedRecordTransitionNotAllowed",
        );

        const { pda: record } =
          findEligibilityRecordPda(
            program.programId,
            fixture.registry,
            SUBJECT_KIND_WALLET,
            pubkeyBytes(wallet),
            CLASS_ID_PRIVE_MEMBER,
          );

        const account =
          await program.account
            .eligibilityRecord.fetch(record);

        assert.strictEqual(
          account.status,
          RECORD_STATUS_SUSPENDED,
        );
      },
    );

    it(
      "rejects refreshing a Revoked record",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_ALL,
        });

        const wallet =
          Keypair.generate().publicKey;

        await upsertPriveRecordByIssuer({
          ...fixture,
          issuer,
          wallet,
        });

        await revokePriveRecord({
          ...fixture,
          wallet,
        });

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
              wallet,
            }),
          "DelegatedRecordTransitionNotAllowed",
        );

        const { pda: record } =
          findEligibilityRecordPda(
            program.programId,
            fixture.registry,
            SUBJECT_KIND_WALLET,
            pubkeyBytes(wallet),
            CLASS_ID_PRIVE_MEMBER,
          );

        const account =
          await program.account
            .eligibilityRecord.fetch(record);

        assert.strictEqual(
          account.status,
          RECORD_STATUS_REVOKED,
        );
      },
    );

    it(
      "pause blocks delegated upsert",
      async () => {
        const fixture =
          await createPriveFixture();

        const issuer =
          Keypair.generate();

        await upsertPriveIssuerGrant({
          ...fixture,
          issuer: issuer.publicKey,
          permissions:
            ISSUER_PERMISSION_CREATE,
        });

        await program.methods
          .pauseRegistry()
          .accountsStrict({
            authority:
              provider.wallet.publicKey,
            registry: fixture.registry,
          })
          .rpc();

        await expectAnchorError(
          () =>
            upsertPriveRecordByIssuer({
              ...fixture,
              issuer,
            }),
          "RegistryPaused",
        );
      },
    );
  },
);
