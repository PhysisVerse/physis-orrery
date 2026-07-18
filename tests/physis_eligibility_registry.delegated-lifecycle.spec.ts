import * as anchor from "@anchor-lang/core";
import { getEligibilityProgram } from "./helpers/eligibility-program.ts";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import assert from "assert";

import {
  AUTH_KIND_DELEGATED_ISSUER,
  AUTH_KIND_ROOT,
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_PROGRAM_ID,
  ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
  GOVERNANCE_MODE_PRIVE_ONLY,
  ISSUER_PERMISSION_CREATE,
  ISSUER_PERMISSION_EXPIRE,
  ISSUER_PERMISSION_SUSPEND,
  LABEL_BYTES,
  METADATA_HASH_BYTES,
  NAME_BYTES,
  RECORD_STATUS_ACTIVE,
  RECORD_STATUS_EXPIRED,
  RECORD_STATUS_PENDING,
  RECORD_STATUS_SUSPENDED,
  SUBJECT_KIND_WALLET,
} from "./helpers/eligibility-constants.ts";

import {
  findEligibilityClassPda,
  findEligibilityRecordPda,
  findEligibilityRegistryPda,
  findIssuerGrantPda,
} from "./helpers/eligibility-pdas.ts";

import {
  initializeCanonicalEpochRegistry,
} from "./helpers/epoch-registry-fixture.ts";

type ParsedEvent = {
  name: string;
  data: Record<string, unknown>;
};

describe("physis_eligibility_registry delegated lifecycle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

  function fixedBytes(value: string, length: number): number[] {
    const bytes = Buffer.alloc(length);
    bytes.write(value, "utf8");
    return Array.from(bytes);
  }

  function metadataHash(seed = 1): number[] {
    return Array.from(Buffer.alloc(METADATA_HASH_BYTES, seed));
  }

  function pubkeyBytes(pubkey: PublicKey): number[] {
    return Array.from(pubkey.toBytes());
  }

  async function chainTime(): Promise<number> {
    const slot = await provider.connection.getSlot("confirmed");
    const blockTime = await provider.connection.getBlockTime(slot);
    return blockTime ?? Math.floor(Date.now() / 1000);
  }

  async function waitForExpiry(expiry: number): Promise<void> {
    const clockTickRecipient = Keypair.generate().publicKey;

    const rentExemptLamports =
      await provider.connection.getMinimumBalanceForRentExemption(0);

    for (let attempt = 0; attempt < 80; attempt += 1) {
      if ((await chainTime()) >= expiry) {
        return;
      }

      const tickTransaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: clockTickRecipient,
          lamports: attempt === 0 ? rentExemptLamports : 1,
        }),
      );

      await provider.sendAndConfirm(tickTransaction, []);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.fail(`Chain time did not reach evidence expiry ${expiry}`);
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
    assert.ok(
      value instanceof PublicKey,
      "Expected decoded event field to be a PublicKey",
    );

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

    assert.notStrictEqual(
      logs,
      null,
      `Transaction logs were unavailable for ${signature}`,
    );

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

    assert.ok(
      event,
      `Expected ${expectedName}; decoded events: ${events
        .map((candidate) => candidate.name)
        .join(", ")}`,
    );

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

    assert.fail(
      `Expected Anchor error ${expectedCode}, but transaction succeeded`,
    );
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

  async function upsertGrant(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    issuer: Keypair;
    permissions: number;
  }): Promise<PublicKey> {
    const { pda: issuerGrant } = findIssuerGrantPda(
      program.programId,
      params.registry,
      CLASS_ID_PRIVE_MEMBER,
      params.issuer.publicKey,
    );

    await program.methods
      .upsertIssuerGrant(
        CLASS_ID_PRIVE_MEMBER,
        params.issuer.publicKey,
        ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
        params.permissions,
        3600,
        new anchor.BN(0),
        new anchor.BN(0),
      )
      .accountsStrict({
        payer: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        issuerGrant,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return issuerGrant;
  }

  async function upsertRootRecord(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    wallet?: PublicKey;
    status?: number;
    source?: number;
    evidenceExpiresAt?: number;
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

    await program.methods
      .upsertEligibilityRecordByAuthority(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        subjectKey,
        wallet,
        params.status ?? RECORD_STATUS_ACTIVE,
        params.source ?? ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
        metadataHash(),
        0,
        0,
        new anchor.BN(params.evidenceExpiresAt ?? 0),
      )
      .accountsStrict({
        payer: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        eligibilityRecord,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return {
      wallet,
      subjectKey,
      eligibilityRecord,
    };
  }

  async function upsertDelegatedRecord(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    issuer: Keypair;
    issuerGrant: PublicKey;
    status?: number;
    evidenceExpiresAt: number;
  }) {
    const wallet = Keypair.generate().publicKey;
    const subjectKey = pubkeyBytes(wallet);

    const { pda: eligibilityRecord } = findEligibilityRecordPda(
      program.programId,
      params.registry,
      SUBJECT_KIND_WALLET,
      subjectKey,
      CLASS_ID_PRIVE_MEMBER,
    );

    await program.methods
      .upsertEligibilityRecordByIssuer(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        subjectKey,
        wallet,
        params.status ?? RECORD_STATUS_ACTIVE,
        metadataHash(2),
        0,
        0,
        new anchor.BN(params.evidenceExpiresAt),
      )
      .accountsStrict({
        payer: provider.wallet.publicKey,
        issuer: params.issuer.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        issuerGrant: params.issuerGrant,
        eligibilityRecord,
        systemProgram: SystemProgram.programId,
      })
      .signers([params.issuer])
      .rpc();

    return {
      wallet,
      subjectKey,
      eligibilityRecord,
    };
  }

  async function suspendByIssuer(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    issuer: Keypair;
    issuerGrant: PublicKey;
    subjectKey: number[];
    eligibilityRecord: PublicKey;
  }): Promise<string> {
    return program.methods
      .suspendEligibilityRecordByIssuer(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        params.subjectKey,
      )
      .accountsStrict({
        issuer: params.issuer.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        issuerGrant: params.issuerGrant,
        eligibilityRecord: params.eligibilityRecord,
      })
      .signers([params.issuer])
      .rpc();
  }

  async function expireByRoot(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    subjectKey: number[];
    eligibilityRecord: PublicKey;
  }): Promise<string> {
    return program.methods
      .expireEligibilityRecord(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        params.subjectKey,
      )
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        eligibilityRecord: params.eligibilityRecord,
      })
      .rpc();
  }

  async function expireByIssuer(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    issuer: Keypair;
    issuerGrant: PublicKey;
    subjectKey: number[];
    eligibilityRecord: PublicKey;
  }): Promise<string> {
    return program.methods
      .expireEligibilityRecordByIssuer(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        params.subjectKey,
      )
      .accountsStrict({
        issuer: params.issuer.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        issuerGrant: params.issuerGrant,
        eligibilityRecord: params.eligibilityRecord,
      })
      .signers([params.issuer])
      .rpc();
  }

  it("root explicitly expires an Active record after evidence expiry", async () => {
    const fixture = await createFixture();
    const expiry = (await chainTime()) + 1;
    const record = await upsertRootRecord({
      ...fixture,
      evidenceExpiresAt: expiry,
    });

    await waitForExpiry(expiry);

    const signature = await expireByRoot({
      ...fixture,
      ...record,
    });

    const account =
      await program.account.eligibilityRecord.fetch(record.eligibilityRecord);

    assert.strictEqual(account.status, RECORD_STATUS_EXPIRED);

    const event = await expectEvent(signature, "EligibilityRecordExpired");

    assert.strictEqual(
      asPublicKey(eventField(event, "actor")).toBase58(),
      provider.wallet.publicKey.toBase58(),
    );
    assert.strictEqual(
      eventField<number>(event, "authKind", "auth_kind"),
      AUTH_KIND_ROOT,
    );
  });

  it("root explicitly expires a Pending record", async () => {
    const fixture = await createFixture();
    const expiry = (await chainTime()) + 1;
    const record = await upsertRootRecord({
      ...fixture,
      status: RECORD_STATUS_PENDING,
      evidenceExpiresAt: expiry,
    });

    await waitForExpiry(expiry);
    await expireByRoot({ ...fixture, ...record });

    const account =
      await program.account.eligibilityRecord.fetch(record.eligibilityRecord);

    assert.strictEqual(account.status, RECORD_STATUS_EXPIRED);
  });

  it("root rejects explicit expiry for unbounded evidence", async () => {
    const fixture = await createFixture();
    const record = await upsertRootRecord(fixture);

    await expectAnchorError(
      () => expireByRoot({ ...fixture, ...record }),
      "EligibilityRecordNotExpirable",
    );
  });

  it("root rejects explicit expiry before evidence expiry", async () => {
    const fixture = await createFixture();
    const record = await upsertRootRecord({
      ...fixture,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await expectAnchorError(
      () => expireByRoot({ ...fixture, ...record }),
      "EvidenceNotYetExpired",
    );
  });

  it("root rejects explicit expiry for a Suspended record", async () => {
    const fixture = await createFixture();
    const record = await upsertRootRecord({
      ...fixture,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await program.methods
      .suspendEligibilityRecord(
        CLASS_ID_PRIVE_MEMBER,
        SUBJECT_KIND_WALLET,
        record.subjectKey,
      )
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
        eligibilityClass: fixture.eligibilityClass,
        eligibilityRecord: record.eligibilityRecord,
      })
      .rpc();

    await expectAnchorError(
      () => expireByRoot({ ...fixture, ...record }),
      "EligibilityRecordNotExpirable",
    );
  });

  it("root rejects explicitly expiring an already Expired record", async () => {
    const fixture = await createFixture();
    const expiry = (await chainTime()) + 1;
    const record = await upsertRootRecord({
      ...fixture,
      evidenceExpiresAt: expiry,
    });

    await waitForExpiry(expiry);
    await expireByRoot({ ...fixture, ...record });

    await expectAnchorError(
      () => expireByRoot({ ...fixture, ...record }),
      "EligibilityRecordAlreadyExpired",
    );
  });

  it("delegated issuer suspends an Active record with SUSPEND permission", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_SUSPEND,
    });

    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    const signature = await suspendByIssuer({
      ...fixture,
      issuer,
      issuerGrant,
      ...record,
    });

    const account =
      await program.account.eligibilityRecord.fetch(record.eligibilityRecord);

    assert.strictEqual(account.status, RECORD_STATUS_SUSPENDED);

    const event = await expectEvent(signature, "EligibilityRecordSuspended");

    assert.strictEqual(
      asPublicKey(eventField(event, "actor")).toBase58(),
      issuer.publicKey.toBase58(),
    );
    assert.strictEqual(
      eventField<number>(event, "authKind", "auth_kind"),
      AUTH_KIND_DELEGATED_ISSUER,
    );
    assert.strictEqual(
      eventField<number>(event, "source"),
      ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
    );
  });

  it("delegated issuer suspends a Pending record", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_SUSPEND,
    });

    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      status: RECORD_STATUS_PENDING,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await suspendByIssuer({
      ...fixture,
      issuer,
      issuerGrant,
      ...record,
    });

    const account =
      await program.account.eligibilityRecord.fetch(record.eligibilityRecord);

    assert.strictEqual(account.status, RECORD_STATUS_SUSPENDED);
  });

  it("delegated suspension requires SUSPEND permission", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions: ISSUER_PERMISSION_CREATE,
    });

    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await expectAnchorError(
      () =>
        suspendByIssuer({
          ...fixture,
          issuer,
          issuerGrant,
          ...record,
        }),
      "IssuerPermissionDenied",
    );
  });

  it("delegated suspension rejects a disabled grant", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_SUSPEND,
    });

    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await program.methods
      .disableIssuerGrant(
        CLASS_ID_PRIVE_MEMBER,
        issuer.publicKey,
      )
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
        eligibilityClass: fixture.eligibilityClass,
        issuerGrant,
      })
      .rpc();

    await expectAnchorError(
      () =>
        suspendByIssuer({
          ...fixture,
          issuer,
          issuerGrant,
          ...record,
        }),
      "IssuerGrantDisabled",
    );
  });

  it("delegated issuer cannot suspend a DAO override record", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions: ISSUER_PERMISSION_SUSPEND,
    });

    const record = await upsertRootRecord(fixture);

    await expectAnchorError(
      () =>
        suspendByIssuer({
          ...fixture,
          issuer,
          issuerGrant,
          ...record,
        }),
      "DelegatedCannotOverwriteDaoOverride",
    );
  });

  it("delegated issuer explicitly expires an Active record", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_EXPIRE,
    });

    const expiry = (await chainTime()) + 1;
    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: expiry,
    });

    await waitForExpiry(expiry);

    const signature = await expireByIssuer({
      ...fixture,
      issuer,
      issuerGrant,
      ...record,
    });

    const account =
      await program.account.eligibilityRecord.fetch(record.eligibilityRecord);

    assert.strictEqual(account.status, RECORD_STATUS_EXPIRED);

    const event = await expectEvent(signature, "EligibilityRecordExpired");

    assert.strictEqual(
      asPublicKey(eventField(event, "actor")).toBase58(),
      issuer.publicKey.toBase58(),
    );
    assert.strictEqual(
      eventField<number>(event, "authKind", "auth_kind"),
      AUTH_KIND_DELEGATED_ISSUER,
    );
  });

  it("delegated explicit expiry requires EXPIRE permission", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions: ISSUER_PERMISSION_CREATE,
    });

    const expiry = (await chainTime()) + 1;
    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: expiry,
    });

    await waitForExpiry(expiry);

    await expectAnchorError(
      () =>
        expireByIssuer({
          ...fixture,
          issuer,
          issuerGrant,
          ...record,
        }),
      "IssuerPermissionDenied",
    );
  });

  it("delegated issuer rejects explicit expiry before evidence expiry", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_EXPIRE,
    });

    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await expectAnchorError(
      () =>
        expireByIssuer({
          ...fixture,
          issuer,
          issuerGrant,
          ...record,
        }),
      "EvidenceNotYetExpired",
    );
  });

  it("delegated issuer cannot expire a Suspended record", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_SUSPEND |
        ISSUER_PERMISSION_EXPIRE,
    });

    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await suspendByIssuer({
      ...fixture,
      issuer,
      issuerGrant,
      ...record,
    });

    await expectAnchorError(
      () =>
        expireByIssuer({
          ...fixture,
          issuer,
          issuerGrant,
          ...record,
        }),
      "EligibilityRecordNotExpirable",
    );
  });

  it("pause blocks delegated suspension", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_SUSPEND,
    });

    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await program.methods
      .pauseRegistry()
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
      })
      .rpc();

    await expectAnchorError(
      () =>
        suspendByIssuer({
          ...fixture,
          issuer,
          issuerGrant,
          ...record,
        }),
      "RegistryPaused",
    );
  });

  it("pause blocks root explicit expiry", async () => {
    const fixture = await createFixture();
    const record = await upsertRootRecord({
      ...fixture,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await program.methods
      .pauseRegistry()
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
      })
      .rpc();

    await expectAnchorError(
      () => expireByRoot({ ...fixture, ...record }),
      "RegistryPaused",
    );
  });

  it("pause blocks delegated explicit expiry", async () => {
    const fixture = await createFixture();
    const issuer = Keypair.generate();
    const issuerGrant = await upsertGrant({
      ...fixture,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_EXPIRE,
    });

    const record = await upsertDelegatedRecord({
      ...fixture,
      issuer,
      issuerGrant,
      evidenceExpiresAt: (await chainTime()) + 3600,
    });

    await program.methods
      .pauseRegistry()
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
      })
      .rpc();

    await expectAnchorError(
      () =>
        expireByIssuer({
          ...fixture,
          issuer,
          issuerGrant,
          ...record,
        }),
      "RegistryPaused",
    );
  });
});
