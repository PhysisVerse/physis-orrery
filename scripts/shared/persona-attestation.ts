import { createHash } from "node:crypto";

import { address } from "@solana/kit";

export const PERSONA_ATTESTATION_SCHEMA =
  "physis-persona-attestation-v1";

export const PERSONA_ATTESTATION_SCHEMA_VERSION = 1;

export const DEFAULT_PERSONA_CLOCK_SKEW_SECONDS = 300;

export type PersonaVerificationStatus =
  | "unverified"
  | "verified"
  | "suspended"
  | "revoked";

export interface PersonaAttestation {
  schema: string;
  schemaVersion: number;
  attestationId: string;
  personaUserId: string;
  wallet: string;
  status: PersonaVerificationStatus;
  walletBindingConfirmed: boolean;
  verifiedAt: number | null;
  expiresAt: number | null;
  revision: number;
  issuer: string;
}

export interface NormalizedPersonaAttestation {
  schema: typeof PERSONA_ATTESTATION_SCHEMA;
  schemaVersion:
	typeof PERSONA_ATTESTATION_SCHEMA_VERSION;
  attestationId: string;
  personaUserId: string;
  wallet: string;
  status: PersonaVerificationStatus;
  walletBindingConfirmed: boolean;
  verifiedAt: number | null;
  expiresAt: number | null;
  revision: number;
  issuer: string;
}

export type PersonaAttestationReason =
  | "verified"
  | "status-not-verified"
  | "wallet-binding-not-confirmed"
  | "expired";

export interface PersonaAttestationEvaluation {
  eligible: boolean;
  reason: PersonaAttestationReason;
  attestation: NormalizedPersonaAttestation;
  evidenceHash: number[] | null;
}

export interface EvaluatePersonaAttestationOptions {
  nowTs?: number;
  maxFutureClockSkewSeconds?: number;
}

const ATTESTATION_KEYS = new Set([
  "schema",
  "schemaVersion",
  "attestationId",
  "personaUserId",
  "wallet",
  "status",
  "walletBindingConfirmed",
  "verifiedAt",
  "expiresAt",
  "revision",
  "issuer",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISSUER_PATTERN =
  /^[a-z0-9][a-z0-9._:-]{0,63}$/;

const PERSONA_STATUSES =
  new Set<PersonaVerificationStatus>([
	"unverified",
	"verified",
	"suspended",
	"revoked",
  ]);

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

function requireExactKeys(
  value: Record<string, unknown>,
): void {
  const actualKeys =
	Object.keys(value);

  for (const key of actualKeys) {
	requireCondition(
	  ATTESTATION_KEYS.has(key),
	  `Unsupported Persona attestation field: ${key}`,
	);
  }

  for (const key of ATTESTATION_KEYS) {
	requireCondition(
	  Object.hasOwn(value, key),
	  `Missing Persona attestation field: ${key}`,
	);
  }
}

function requireString(
  value: Record<string, unknown>,
  key: string,
): string {
  const candidate =
	value[key];

  requireCondition(
	typeof candidate === "string",
	`Persona attestation field "${key}" must be a string`,
  );

  return candidate;
}

function requireBoolean(
  value: Record<string, unknown>,
  key: string,
): boolean {
  const candidate =
	value[key];

  requireCondition(
	typeof candidate === "boolean",
	`Persona attestation field "${key}" must be a boolean`,
  );

  return candidate;
}

function requireNumber(
  value: Record<string, unknown>,
  key: string,
): number {
  const candidate =
	value[key];

  requireCondition(
	typeof candidate === "number",
	`Persona attestation field "${key}" must be a number`,
  );

  return candidate;
}

function requireNullableNumber(
  value: Record<string, unknown>,
  key: string,
): number | null {
  const candidate =
	value[key];

  requireCondition(
	candidate === null ||
	  typeof candidate === "number",
	`Persona attestation field "${key}" must be a number or null`,
  );

  return candidate;
}

function normalizeUuid(
  label: string,
  value: string,
): string {
  const normalized =
	value.trim().toLowerCase();

  requireCondition(
	UUID_PATTERN.test(normalized),
	`${label} must be a canonical UUID`,
  );

  return normalized;
}

function normalizeWallet(
  value: string,
): string {
  const normalized =
	value.trim();

  requireCondition(
	normalized.length > 0,
	"Persona wallet must not be empty",
  );

  try {
	return address(normalized);
  } catch {
	throw new Error(
	  `Persona wallet is not a valid Solana address: ${normalized}`,
	);
  }
}

function normalizeStatus(
  value: string,
): PersonaVerificationStatus {
  requireCondition(
	PERSONA_STATUSES.has(
	  value as PersonaVerificationStatus,
	),
	`Invalid Persona verification status: ${value}`,
  );

  return value as PersonaVerificationStatus;
}

function normalizeIssuer(
  value: string,
): string {
  const normalized =
	value.trim().toLowerCase();

  requireCondition(
	ISSUER_PATTERN.test(normalized),
	[
	  "Persona attestation issuer must contain only",
	  "lowercase letters, numbers, period, colon, underscore or hyphen",
	].join(" "),
  );

  return normalized;
}

function normalizePositiveInteger(
  label: string,
  value: number,
): number {
  requireCondition(
	Number.isSafeInteger(value) &&
	  value > 0,
	`${label} must be a positive safe integer`,
  );

  return value;
}

function normalizeNullableTimestamp(
  label: string,
  value: number | null,
): number | null {
  if (value === null) {
	return null;
  }

  return normalizePositiveInteger(
	label,
	value,
  );
}

function normalizeCurrentTimestamp(
  value: number,
): number {
  return normalizePositiveInteger(
	"Current timestamp",
	value,
  );
}

function normalizeClockSkew(
  value: number,
): number {
  requireCondition(
	Number.isSafeInteger(value) &&
	  value >= 0,
	"Clock skew must be a non-negative safe integer",
  );

  return value;
}

export function parsePersonaAttestation(
  value: unknown,
): PersonaAttestation {
  requireCondition(
	isRecord(value),
	"Persona attestation must be a JSON object",
  );

  requireExactKeys(value);

  return {
	schema:
	  requireString(value, "schema"),
	schemaVersion:
	  requireNumber(
		value,
		"schemaVersion",
	  ),
	attestationId:
	  requireString(
		value,
		"attestationId",
	  ),
	personaUserId:
	  requireString(
		value,
		"personaUserId",
	  ),
	wallet:
	  requireString(value, "wallet"),
	status:
	  normalizeStatus(
		requireString(value, "status"),
	  ),
	walletBindingConfirmed:
	  requireBoolean(
		value,
		"walletBindingConfirmed",
	  ),
	verifiedAt:
	  requireNullableNumber(
		value,
		"verifiedAt",
	  ),
	expiresAt:
	  requireNullableNumber(
		value,
		"expiresAt",
	  ),
	revision:
	  requireNumber(
		value,
		"revision",
	  ),
	issuer:
	  requireString(value, "issuer"),
  };
}

export function normalizePersonaAttestation(
  input: PersonaAttestation,
): NormalizedPersonaAttestation {
  requireCondition(
	input.schema ===
	  PERSONA_ATTESTATION_SCHEMA,
	[
	  "Unsupported Persona attestation schema.",
	  `Expected: ${PERSONA_ATTESTATION_SCHEMA}`,
	  `Actual:   ${input.schema}`,
	].join("\n"),
  );

  requireCondition(
	input.schemaVersion ===
	  PERSONA_ATTESTATION_SCHEMA_VERSION,
	[
	  "Unsupported Persona attestation schema version.",
	  `Expected: ${PERSONA_ATTESTATION_SCHEMA_VERSION}`,
	  `Actual:   ${input.schemaVersion}`,
	].join("\n"),
  );

  const verifiedAt =
	normalizeNullableTimestamp(
	  "verifiedAt",
	  input.verifiedAt,
	);

  const expiresAt =
	normalizeNullableTimestamp(
	  "expiresAt",
	  input.expiresAt,
	);

  if (
	verifiedAt !== null &&
	expiresAt !== null
  ) {
	requireCondition(
	  expiresAt > verifiedAt,
	  "expiresAt must be later than verifiedAt",
	);
  }

  return {
	schema:
	  PERSONA_ATTESTATION_SCHEMA,
	schemaVersion:
	  PERSONA_ATTESTATION_SCHEMA_VERSION,
	attestationId:
	  normalizeUuid(
		"attestationId",
		input.attestationId,
	  ),
	personaUserId:
	  normalizeUuid(
		"personaUserId",
		input.personaUserId,
	  ),
	wallet:
	  normalizeWallet(input.wallet),
	status:
	  normalizeStatus(input.status),
	walletBindingConfirmed:
	  input.walletBindingConfirmed,
	verifiedAt,
	expiresAt,
	revision:
	  normalizePositiveInteger(
		"revision",
		input.revision,
	  ),
	issuer:
	  normalizeIssuer(input.issuer),
  };
}

export function buildPersonaEvidencePayload(
  attestation: NormalizedPersonaAttestation,
): string {
  requireCondition(
	attestation.status === "verified",
	"Persona evidence can only be built for a verified attestation",
  );

  requireCondition(
	attestation.walletBindingConfirmed,
	"Persona evidence requires confirmed wallet binding",
  );

  requireCondition(
	attestation.verifiedAt !== null,
	"Persona evidence requires verifiedAt",
  );

  return [
	`schema=${attestation.schema}`,
	`schema_version=${attestation.schemaVersion}`,
	`attestation_id=${attestation.attestationId}`,
	`persona_user_id=${attestation.personaUserId}`,
	`wallet=${attestation.wallet}`,
	`status=${attestation.status}`,
	`wallet_binding_confirmed=${attestation.walletBindingConfirmed}`,
	`verified_at=${attestation.verifiedAt}`,
	`expires_at=${attestation.expiresAt ?? "none"}`,
	`revision=${attestation.revision}`,
	`issuer=${attestation.issuer}`,
	"",
  ].join("\n");
}

export function buildPersonaEvidenceHash(
  attestation: NormalizedPersonaAttestation,
): number[] {
  return Array.from(
	createHash("sha256")
	  .update(
		buildPersonaEvidencePayload(
		  attestation,
		),
		"utf8",
	  )
	  .digest(),
  );
}

export function evaluatePersonaAttestation(
  input: PersonaAttestation,
  options:
	EvaluatePersonaAttestationOptions = {},
): PersonaAttestationEvaluation {
  const attestation =
	normalizePersonaAttestation(input);

  const nowTs =
	normalizeCurrentTimestamp(
	  options.nowTs ??
		Math.floor(Date.now() / 1000),
	);

  const maxFutureClockSkewSeconds =
	normalizeClockSkew(
	  options.maxFutureClockSkewSeconds ??
		DEFAULT_PERSONA_CLOCK_SKEW_SECONDS,
	);

  if (attestation.status !== "verified") {
	return {
	  eligible: false,
	  reason: "status-not-verified",
	  attestation,
	  evidenceHash: null,
	};
  }

  if (!attestation.walletBindingConfirmed) {
	return {
	  eligible: false,
	  reason:
		"wallet-binding-not-confirmed",
	  attestation,
	  evidenceHash: null,
	};
  }

  requireCondition(
	attestation.verifiedAt !== null,
	"A verified Persona attestation requires verifiedAt",
  );

  requireCondition(
	attestation.verifiedAt <=
	  nowTs +
		maxFutureClockSkewSeconds,
	"Persona verifiedAt is unreasonably far in the future",
  );

  if (
	attestation.expiresAt !== null &&
	attestation.expiresAt <= nowTs
  ) {
	return {
	  eligible: false,
	  reason: "expired",
	  attestation,
	  evidenceHash: null,
	};
  }

  return {
	eligible: true,
	reason: "verified",
	attestation,
	evidenceHash:
	  buildPersonaEvidenceHash(
		attestation,
	  ),
  };
}
