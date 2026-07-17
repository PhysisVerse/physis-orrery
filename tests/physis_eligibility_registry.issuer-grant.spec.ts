import * as anchor from "@anchor-lang/core";
import { getEligibilityProgram } from "./helpers/eligibility-program.ts";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import assert from "assert";

import {
  CLASS_ID_PERSONA_VERIFIED,
  CLASS_ID_PRIVE_MEMBER,
  CLASS_KIND_PERSONA_VERIFIED,
  CLASS_KIND_PRIVE_MEMBER,
  CLASS_STATUS_ACTIVE,
  ELIGIBILITY_PROGRAM_ID,
  ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
  ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
  ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
  GOVERNANCE_MODE_PRIVE_ONLY,
  ISSUER_GRANT_VERSION,
  ISSUER_PERMISSION_ALL,
  ISSUER_PERMISSION_CREATE,
  ISSUER_PERMISSION_REFRESH,
  LABEL_BYTES,
  NAME_BYTES,
} from "./helpers/eligibility-constants.ts";

import {
  findEligibilityClassPda,
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

const ISSUER_GRANT_ACCOUNT_SPACE = 8 + 238;

describe("physis_eligibility_registry issuer grants", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = getEligibilityProgram();

  assert.strictEqual(program.programId.toBase58(), ELIGIBILITY_PROGRAM_ID);

  function fixedBytes(value: string, length: number): number[] {
    const bytes = Buffer.alloc(length);
    bytes.write(value, "utf8");
    return Array.from(bytes);
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

  async function initializeRegistry(): Promise<PublicKey> {
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

    return registry;
  }

  async function createClass(
    registry: PublicKey,
    classId: number,
  ): Promise<PublicKey> {
    const isPrive = classId === CLASS_ID_PRIVE_MEMBER;

    const { pda: eligibilityClass } = findEligibilityClassPda(
      program.programId,
      registry,
      classId,
    );

    await program.methods
      .upsertEligibilityClass(
        classId,
        fixedBytes(
          isPrive ? "PRIVE_MEMBER" : "PERSONA_VERIFIED",
          NAME_BYTES,
        ),
        fixedBytes(isPrive ? "PRIVE" : "PERSONA", LABEL_BYTES),
        isPrive
          ? CLASS_KIND_PRIVE_MEMBER
          : CLASS_KIND_PERSONA_VERIFIED,
        CLASS_STATUS_ACTIVE,
        true,
        isPrive,
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

    return eligibilityClass;
  }

  async function upsertGrant(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    classId: number;
    issuer?: PublicKey;
    allowedSource?: number;
    permissions?: number;
    maxEvidenceTtlSeconds?: number;
    validFromTs?: number;
    validUntilTs?: number;
    authority?: Keypair;
  }) {
    const issuer = params.issuer ?? Keypair.generate().publicKey;

    const { pda: issuerGrant, bump } = findIssuerGrantPda(
      program.programId,
      params.registry,
      params.classId,
      issuer,
    );

    const builder = program.methods
      .upsertIssuerGrant(
        params.classId,
        issuer,
        params.allowedSource ??
          ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
        params.permissions ?? ISSUER_PERMISSION_ALL,
        params.maxEvidenceTtlSeconds ?? 3600,
        new anchor.BN(params.validFromTs ?? 0),
        new anchor.BN(params.validUntilTs ?? 0),
      )
      .accountsStrict({
        payer: provider.wallet.publicKey,
        authority:
          params.authority?.publicKey ?? provider.wallet.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        issuerGrant,
        systemProgram: SystemProgram.programId,
      });

    const signature = params.authority
      ? await builder.signers([params.authority]).rpc()
      : await builder.rpc();

    return {
      signature,
      issuer,
      issuerGrant,
      bump,
    };
  }

  async function disableGrant(params: {
    registry: PublicKey;
    eligibilityClass: PublicKey;
    classId: number;
    issuer: PublicKey;
    authority?: Keypair;
  }): Promise<string> {
    const { pda: issuerGrant } = findIssuerGrantPda(
      program.programId,
      params.registry,
      params.classId,
      params.issuer,
    );

    const builder = program.methods
      .disableIssuerGrant(
        params.classId,
        params.issuer,
      )
      .accountsStrict({
        authority:
          params.authority?.publicKey ?? provider.wallet.publicKey,
        registry: params.registry,
        eligibilityClass: params.eligibilityClass,
        issuerGrant,
      });

    return params.authority
      ? builder.signers([params.authority]).rpc()
      : builder.rpc();
  }

  async function createPriveFixture() {
    const registry = await initializeRegistry();

    const eligibilityClass = await createClass(
      registry,
      CLASS_ID_PRIVE_MEMBER,
    );

    return {
      registry,
      eligibilityClass,
    };
  }

  async function createPersonaFixture() {
    const registry = await initializeRegistry();

    const eligibilityClass = await createClass(
      registry,
      CLASS_ID_PERSONA_VERIFIED,
    );

    return {
      registry,
      eligibilityClass,
    };
  }

  it("creates an exact-size class-scoped PRIVÉ issuer grant", async () => {
    const fixture = await createPriveFixture();
    const now = nowUnixSeconds();

    const {
      signature,
      issuer,
      issuerGrant,
      bump,
    } = await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
      allowedSource:
        ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
      permissions: ISSUER_PERMISSION_ALL,
      maxEvidenceTtlSeconds: 7200,
      validFromTs: now - 60,
      validUntilTs: now + 7200,
    });

    const account =
      await program.account.issuerGrant.fetch(issuerGrant);

    assert.strictEqual(account.version, ISSUER_GRANT_VERSION);
    assert.strictEqual(
      account.registry.toBase58(),
      fixture.registry.toBase58(),
    );
    assert.strictEqual(
      account.eligibilityClass.toBase58(),
      fixture.eligibilityClass.toBase58(),
    );
    assert.strictEqual(account.classId, CLASS_ID_PRIVE_MEMBER);
    assert.strictEqual(account.issuer.toBase58(), issuer.toBase58());
    assert.strictEqual(
      account.allowedSource,
      ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
    );
    assert.strictEqual(account.permissions, ISSUER_PERMISSION_ALL);
    assert.strictEqual(account.enabled, true);
    assert.strictEqual(account.maxEvidenceTtlSeconds, 7200);
    assert.strictEqual(account.validFromTs.toNumber(), now - 60);
    assert.strictEqual(account.validUntilTs.toNumber(), now + 7200);
    assert.strictEqual(account.bump, bump);
    assert.ok(account.createdTs.toNumber() > 0);
    assert.ok(account.updatedTs.toNumber() > 0);

    const accountInfo =
      await provider.connection.getAccountInfo(issuerGrant);

    assert.notStrictEqual(accountInfo, null);
    assert.strictEqual(
      accountInfo!.data.length,
      ISSUER_GRANT_ACCOUNT_SPACE,
    );

    const event = await expectEvent(
      signature,
      "IssuerGrantUpserted",
    );

    assert.strictEqual(
      asPublicKey(eventField(event, "issuerGrant", "issuer_grant"))
        .toBase58(),
      issuerGrant.toBase58(),
    );
    assert.strictEqual(
      asPublicKey(eventField(event, "issuer")).toBase58(),
      issuer.toBase58(),
    );
    assert.strictEqual(
      eventField<number>(
        event,
        "allowedSource",
        "allowed_source",
      ),
      ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
    );
    assert.strictEqual(
      eventField<number>(event, "permissions"),
      ISSUER_PERMISSION_ALL,
    );
    assert.strictEqual(eventField<boolean>(event, "enabled"), true);
  });

  it("creates a Persona issuer grant for Persona attestations", async () => {
    const fixture = await createPersonaFixture();

    const { issuerGrant } = await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PERSONA_VERIFIED,
      allowedSource: ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
    });

    const account =
      await program.account.issuerGrant.fetch(issuerGrant);

    assert.strictEqual(account.classId, CLASS_ID_PERSONA_VERIFIED);
    assert.strictEqual(
      account.allowedSource,
      ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
    );
  });

  it("updates grant configuration without changing its identity", async () => {
    const fixture = await createPriveFixture();
    const issuer = Keypair.generate().publicKey;
    const now = nowUnixSeconds();

    const first = await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
      issuer,
      permissions: ISSUER_PERMISSION_CREATE,
      maxEvidenceTtlSeconds: 1800,
      validFromTs: now - 30,
      validUntilTs: now + 1800,
    });

    const before =
      await program.account.issuerGrant.fetch(first.issuerGrant);

    const second = await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
      issuer,
      permissions:
        ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_REFRESH,
      maxEvidenceTtlSeconds: 3600,
      validFromTs: now,
      validUntilTs: now + 3600,
    });

    const after =
      await program.account.issuerGrant.fetch(second.issuerGrant);

    assert.strictEqual(
      first.issuerGrant.toBase58(),
      second.issuerGrant.toBase58(),
    );
    assert.strictEqual(
      after.createdTs.toString(),
      before.createdTs.toString(),
    );
    assert.strictEqual(
      after.allowedSource,
      ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
    );
    assert.strictEqual(
      after.permissions,
      ISSUER_PERMISSION_CREATE |
        ISSUER_PERMISSION_REFRESH,
    );
    assert.strictEqual(after.maxEvidenceTtlSeconds, 3600);
    assert.strictEqual(after.enabled, true);
    assert.ok(
      after.updatedSlot.gte(before.updatedSlot),
    );
  });

  it("disables an issuer grant and emits its audit event", async () => {
    const fixture = await createPriveFixture();

    const { issuer, issuerGrant } = await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
    });

    const signature = await disableGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
      issuer,
    });

    const account =
      await program.account.issuerGrant.fetch(issuerGrant);

    assert.strictEqual(account.enabled, false);

    const event = await expectEvent(
      signature,
      "IssuerGrantDisabled",
    );

    assert.strictEqual(
      asPublicKey(eventField(event, "issuerGrant", "issuer_grant"))
        .toBase58(),
      issuerGrant.toBase58(),
    );
    assert.strictEqual(
      asPublicKey(eventField(event, "issuer")).toBase58(),
      issuer.toBase58(),
    );
  });

  it("re-enables a disabled grant through root-authority upsert", async () => {
    const fixture = await createPriveFixture();

    const { issuer, issuerGrant } = await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
    });

    await disableGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
      issuer,
    });

    await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
      issuer,
      permissions: ISSUER_PERMISSION_CREATE,
    });

    const account =
      await program.account.issuerGrant.fetch(issuerGrant);

    assert.strictEqual(account.enabled, true);
    assert.strictEqual(
      account.permissions,
      ISSUER_PERMISSION_CREATE,
    );
  });

  it("rejects disabling an already disabled grant", async () => {
    const fixture = await createPriveFixture();

    const { issuer } = await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
    });

    await disableGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
      issuer,
    });

    await expectAnchorError(
      () =>
        disableGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          issuer,
        }),
      "IssuerGrantAlreadyDisabled",
    );
  });

  it("rejects DAO governance override as a delegated source", async () => {
    const fixture = await createPriveFixture();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          allowedSource:
            ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
        }),
      "InvalidIssuerGrantSource",
    );
  });

  it("rejects a delegated source belonging to another class", async () => {
    const fixture = await createPriveFixture();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          allowedSource:
            ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
        }),
      "EligibilitySourceClassMismatch",
    );
  });

  it("rejects the default pubkey as an issuer", async () => {
    const fixture = await createPriveFixture();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          issuer: PublicKey.default,
        }),
      "InvalidIssuer",
    );
  });

  it("rejects an empty permission mask", async () => {
    const fixture = await createPriveFixture();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          permissions: 0,
        }),
      "InvalidIssuerGrantPermissions",
    );
  });

  it("rejects unknown permission bits", async () => {
    const fixture = await createPriveFixture();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          permissions: 1 << 5,
        }),
      "InvalidIssuerGrantPermissions",
    );
  });

  it("rejects a zero evidence TTL", async () => {
    const fixture = await createPriveFixture();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          maxEvidenceTtlSeconds: 0,
        }),
      "InvalidIssuerGrantTtl",
    );
  });

  it("rejects an inverted grant validity window", async () => {
    const fixture = await createPriveFixture();
    const now = nowUnixSeconds();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          validFromTs: now + 3600,
          validUntilTs: now + 60,
        }),
      "InvalidIssuerGrantValidityWindow",
    );
  });

  it("rejects changing the grant source after creation", async () => {
    const fixture = await createPriveFixture();
    const issuer = Keypair.generate().publicKey;

    await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
      issuer,
      allowedSource:
        ELIGIBILITY_SOURCE_PRIVE_COLLECTION_ATTESTATION,
    });

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          issuer,
          allowedSource:
            ELIGIBILITY_SOURCE_PERSONA_ATTESTATION,
        }),
      "IssuerGrantSourceImmutable",
    );
  });

  it("rejects grant upsert from the wrong authority", async () => {
    const fixture = await createPriveFixture();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          authority: Keypair.generate(),
        }),
      "InvalidAuthority",
    );
  });

  it("pause blocks issuer grant upsert", async () => {
    const fixture = await createPriveFixture();

    await program.methods
      .pauseRegistry()
      .accountsStrict({
        authority: provider.wallet.publicKey,
        registry: fixture.registry,
      })
      .rpc();

    await expectAnchorError(
      () =>
        upsertGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
        }),
      "RegistryPaused",
    );
  });

  it("pause blocks issuer grant disable", async () => {
    const fixture = await createPriveFixture();

    const { issuer } = await upsertGrant({
      ...fixture,
      classId: CLASS_ID_PRIVE_MEMBER,
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
        disableGrant({
          ...fixture,
          classId: CLASS_ID_PRIVE_MEMBER,
          issuer,
        }),
      "RegistryPaused",
    );
  });
});
