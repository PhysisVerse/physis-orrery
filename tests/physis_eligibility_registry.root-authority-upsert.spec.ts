import * as anchor from "@anchor-lang/core";
import { getEligibilityProgram } from "./helpers/eligibility-program.ts";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import assert from "assert";

import {
  AUTH_KIND_ROOT,
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_PROGRAM_ID,
  ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
  GOVERNANCE_MODE_PRIVE_ONLY,
  LABEL_BYTES,
  METADATA_HASH_BYTES,
  NAME_BYTES,
  RECORD_STATUS_ACTIVE,
  RECORD_STATUS_PENDING,
  RECORD_STATUS_REVOKED,
  RECORD_STATUS_SUSPENDED,
  SUBJECT_KIND_WALLET,
} from "./helpers/eligibility-constants.ts";

import {
  findEligibilityClassPda,
  findEligibilityRecordPda,
  findEligibilityRegistryPda,
} from "./helpers/eligibility-pdas.ts";

import {
  initializeCanonicalEpochRegistry,
} from "./helpers/epoch-registry-fixture.ts";

type ParsedEvent = {
  name: string;
  data: Record<string, unknown>;
};

describe("physis_eligibility_registry root-authority record upsert", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

  function fixedBytes(value: string, length: number): number[] {
    const bytes = Buffer.alloc(length);
    bytes.write(value, "utf8");
    return Array.from(bytes);
  }

  function evidenceHash(fill = 7): number[] {
    return Array.from(Buffer.alloc(METADATA_HASH_BYTES, fill));
  }

  function pubkeyBytes(pubkey: PublicKey): number[] {
    return Array.from(pubkey.toBytes());
  }

  function nowUnixSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  function eventField<T>(
    data: Record<string, unknown>,
    camelCaseName: string,
    snakeCaseName?: string,
  ): T {
    if (camelCaseName in data) {
      return data[camelCaseName] as T;
    }

    if (snakeCaseName && snakeCaseName in data) {
      return data[snakeCaseName] as T;
    }

    assert.fail(`Missing event field: ${camelCaseName}`);
  }

  function asPublicKey(value: unknown): PublicKey {
    assert.ok(value instanceof PublicKey);
    return value;
  }

  async function loadEvents(signature: string): Promise<ParsedEvent[]> {
    let logs: string[] | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const transaction = await provider.connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      logs = transaction?.meta?.logMessages ?? null;

      if (logs) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    assert.notStrictEqual(logs, null);

    const parser = new anchor.EventParser(program.programId, program.coder);

    return Array.from(parser.parseLogs(logs!)).map((event) => ({
      name: event.name,
      data: event.data as Record<string, unknown>,
    }));
  }

  async function expectEvent(
    signature: string,
    expectedName: string,
  ): Promise<Record<string, unknown>> {
    const events = await loadEvents(signature);
    const event = events.find(
      (candidate) =>
        candidate.name.toLowerCase() === expectedName.toLowerCase(),
    );

    assert.ok(event, `Expected ${expectedName}`);
    return event.data;
  }

  async function expectAnchorError(
    promiseFactory: () => Promise<unknown>,
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

    assert.fail(`Expected Anchor error ${expectedCode}`);
  }

  async function createFixture() {
    const realm = Keypair.generate();
    const epochRegistry =
      await initializeCanonicalEpochRegistry(realm.publicKey);

    const { pda: registry } = findEligibilityRegistryPda(
      program.programId,
      realm.publicKey,
    );

    await program.methods
      .initializeRegistry(GOVERNANCE_MODE_PRIVE_ONLY)
      .accountsStrict({
        payer: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
        realm: realm.publicKey,
        epochRegistry,
        registry,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const { pda: eligibilityClass } = findEligibilityClassPda(
      program.programId,
      registry,
      CLASS_ID_PRIVE_MEMBER,
    );

    await program.methods
      .upsertEligibilityClass(
        CLASS_ID_PRIVE_MEMBER,
        fixedBytes("PRIVE_MEMBER", NAME_BYTES),
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
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return {
      registry,
      eligibilityClass,
    };
  }

  async function upsertRoot(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    wallet?: PublicKey;
    status?: number;
    metadataHash?: number[];
    evidenceExpiresAt?: number;
    authority?: Keypair;
  }) {
    const wallet = params.wallet ?? Keypair.generate().publicKey;
    const subjectKey = pubkeyBytes(wallet);

    const { pda: eligibilityRecord } = findEligibilityRecordPda(
      program.programId,
      params.registry,
      SUBJECT_KIND_WALLET,
      subjectKey,
      CLASS_ID_PRIVE_MEMBER,
    );

    const builder = program.methods
      .upsertEligibilityRecordByAuthority(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        subjectKey,
        wallet,
        params.status ?? RECORD_STATUS_ACTIVE,
        ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
        params.metadataHash ?? evidenceHash(),
        0,
        0,
        new anchor.BN(params.evidenceExpiresAt ?? 0),
      )
      .accountsStrict({
        payer: provider.wallet.publicKey,
        authority:
          params.authority?.publicKey ?? provider.wallet.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        eligibilityRecord,
        systemProgram: SystemProgram.programId,
      });

    const signature = params.authority
      ? await builder.signers([params.authority]).rpc()
      : await builder.rpc();

    return {
      signature,
      wallet,
      subjectKey,
      eligibilityRecord,
    };
  }

  it("creates bounded evidence with the authenticated root authority", async () => {
    const fixture = await createFixture();
    const evidenceExpiresAt = nowUnixSeconds() + 3600;
    const metadataHash = evidenceHash(9);

    const { signature, eligibilityRecord } = await upsertRoot({
      ...fixture,
      metadataHash,
      evidenceExpiresAt,
    });

    const account =
      await program.account.eligibilityRecord.fetch(eligibilityRecord);

    assert.strictEqual(
      account.issuer.toBase58(),
      provider.wallet.publicKey.toBase58(),
    );
    assert.deepStrictEqual(account.metadataHash, metadataHash);
    assert.ok(account.evidenceIssuedAt.gt(new anchor.BN(0)));
    assert.strictEqual(
      account.evidenceExpiresAt.toNumber(),
      evidenceExpiresAt,
    );

    const event = await expectEvent(
      signature,
      "EligibilityRecordUpserted",
    );

    assert.strictEqual(
      asPublicKey(eventField(event, "issuer")).toBase58(),
      provider.wallet.publicKey.toBase58(),
    );
    assert.strictEqual(
      eventField<number>(event, "authKind", "auth_kind"),
      AUTH_KIND_ROOT,
    );
  });

  it("allows intentionally unbounded root evidence", async () => {
    const fixture = await createFixture();

    const { eligibilityRecord } = await upsertRoot(fixture);

    const account =
      await program.account.eligibilityRecord.fetch(eligibilityRecord);

    assert.strictEqual(account.evidenceExpiresAt.toNumber(), 0);
  });

  it("activates a Pending record", async () => {
    const fixture = await createFixture();
    const wallet = Keypair.generate().publicKey;

    const { eligibilityRecord } = await upsertRoot({
      ...fixture,
      wallet,
      status: RECORD_STATUS_PENDING,
    });

    await upsertRoot({
      ...fixture,
      wallet,
      status: RECORD_STATUS_ACTIVE,
      metadataHash: evidenceHash(8),
    });

    const account =
      await program.account.eligibilityRecord.fetch(eligibilityRecord);

    assert.strictEqual(account.status, RECORD_STATUS_ACTIVE);
  });

  it("rejects an all-zero evidence hash", async () => {
    const fixture = await createFixture();

    await expectAnchorError(
      () =>
        upsertRoot({
          ...fixture,
          metadataHash: Array.from(Buffer.alloc(METADATA_HASH_BYTES)),
        }),
      "InvalidMetadataHash",
    );
  });

  it("rejects a nonfuture bounded expiry", async () => {
    const fixture = await createFixture();

    await expectAnchorError(
      () =>
        upsertRoot({
          ...fixture,
          evidenceExpiresAt: nowUnixSeconds() - 1,
        }),
      "InvalidEvidenceExpiry",
    );
  });

  it("rejects Active to Pending regression", async () => {
    const fixture = await createFixture();
    const wallet = Keypair.generate().publicKey;

    await upsertRoot({
      ...fixture,
      wallet,
      status: RECORD_STATUS_ACTIVE,
    });

    await expectAnchorError(
      () =>
        upsertRoot({
          ...fixture,
          wallet,
          status: RECORD_STATUS_PENDING,
          metadataHash: evidenceHash(8),
        }),
      "RootRecordTransitionNotAllowed",
    );
  });

  it("recovers a Suspended record to Active", async () => {
    const fixture = await createFixture();
    const wallet = Keypair.generate().publicKey;

    const { eligibilityRecord, subjectKey } = await upsertRoot({
      ...fixture,
      wallet,
    });

    await program.methods
      .suspendEligibilityRecord(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        subjectKey,
      )
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
        eligibilityClass: fixture.eligibilityClass,
        eligibilityRecord,
      })
      .rpc();

    let account =
      await program.account.eligibilityRecord.fetch(eligibilityRecord);
    assert.strictEqual(account.status, RECORD_STATUS_SUSPENDED);

    await upsertRoot({
      ...fixture,
      wallet,
      metadataHash: evidenceHash(8),
    });

    account = await program.account.eligibilityRecord.fetch(eligibilityRecord);
    assert.strictEqual(account.status, RECORD_STATUS_ACTIVE);
  });

  it("recovers a Revoked record to Active", async () => {
    const fixture = await createFixture();
    const wallet = Keypair.generate().publicKey;

    const { eligibilityRecord, subjectKey } = await upsertRoot({
      ...fixture,
      wallet,
    });

    await program.methods
      .revokeEligibilityRecord(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        subjectKey,
      )
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
        eligibilityClass: fixture.eligibilityClass,
        eligibilityRecord,
      })
      .rpc();

    let account =
      await program.account.eligibilityRecord.fetch(eligibilityRecord);
    assert.strictEqual(account.status, RECORD_STATUS_REVOKED);

    await upsertRoot({
      ...fixture,
      wallet,
      metadataHash: evidenceHash(8),
    });

    account = await program.account.eligibilityRecord.fetch(eligibilityRecord);
    assert.strictEqual(account.status, RECORD_STATUS_ACTIVE);
  });

  it("rejects a non-root signer", async () => {
    const fixture = await createFixture();

    await expectAnchorError(
      () =>
        upsertRoot({
          ...fixture,
          authority: Keypair.generate(),
        }),
      "InvalidAuthority",
    );
  });

  it("pause blocks root-authority upsert", async () => {
    const fixture = await createFixture();

    await program.methods
      .pauseRegistry()
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
      })
      .rpc();

    await expectAnchorError(
      () => upsertRoot(fixture),
      "RegistryPaused",
    );
  });
});
