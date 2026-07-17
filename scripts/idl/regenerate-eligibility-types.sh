#!/usr/bin/env bash

set -euo pipefail

IDL_JSON="target/idl/physis_eligibility_registry.json"
TARGET_TYPE="target/types/physis_eligibility_registry.ts"
CHECKED_IN_TYPE="packages/idl-types/physis_eligibility_registry.ts"

if [[ ! -s "$IDL_JSON" ]]; then
  echo "ERROR: missing generated eligibility IDL: $IDL_JSON" >&2
  echo "Run anchor build first." >&2
  exit 1
fi

tmp_type="$(mktemp)"
trap 'rm -f "$tmp_type"' EXIT

anchor idl type "$IDL_JSON" > "$tmp_type"

if [[ ! -s "$tmp_type" ]]; then
  echo "ERROR: anchor idl type produced an empty file" >&2
  exit 1
fi

if ! grep -q 'export type PhysisEligibilityRegistry' "$tmp_type"; then
  echo "ERROR: generated file is not the eligibility TypeScript IDL" >&2
  exit 1
fi

mkdir -p \
  "$(dirname "$TARGET_TYPE")" \
  "$(dirname "$CHECKED_IN_TYPE")"

install -m 0644 "$tmp_type" "$TARGET_TYPE"
install -m 0644 "$tmp_type" "$CHECKED_IN_TYPE"

echo "Regenerated eligibility TypeScript IDL:"
wc -c "$TARGET_TYPE" "$CHECKED_IN_TYPE"
