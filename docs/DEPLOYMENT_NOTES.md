# Orrery Deployment Notes

## Scope

This document records the working deployment process for the Orrery on-chain program suite, beginning with:

```text
physis_epoch_registry
```

Program ID:

```text
PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

The process below reflects the actual working localnet, devnet, and mainnet path, including verified build, Program Metadata, IDL handling, and DAO authority handoff preparation.

---

## Core Principles

Orrery deployment follows these principles:

```text
1. Build and test locally before every deployment.
2. Use the same vanity program ID across environments.
3. Do not commit private keypairs or RPC secrets.
4. Mainnet program deployment may begin with a developer wallet as temporary upgrade authority.
5. Program upgrade authority must be transferred to the DAO before the program is considered DAO-owned.
6. Mainnet registry initialization should be executed through Realms, not from a developer wallet.
7. Verifiable build and metadata should be completed before DAO authority transfer when possible.
8. Do not run a normal build between a verifiable build and deploying the verified artifact.
```

---

## Known Program Constants

Program name:

```text
physis_epoch_registry
```

Program ID:

```text
PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

Realm:

```text
DsWWtZrqXBcqTTPoEyFH793Euq82r95CuXWTwqo3JZur
```

Realm authority / Main-Council governance row:

```text
29epeLvAMyRXtpA1HaoKB1hGcAnrc1NvMCbaZ8AVRwEi
```

Target Orrery program authority / DAO-controlled authority:

```text
6ZuPrCK472jw3ZjRBqa6PZQ1tyVvY5BuYfWS7GMq7hX8
```

Developer/deploy wallet used during initial deployment:

```text
wfSXjyiLAv2mmCyPBhgT5ZNaPtAenNjQ6jaanQpdJJm
```

ASTRALIS epoch zero:

```text
1725148800
```

ASTRALIS epoch duration:

```text
21600 seconds
```

Physis year start:

```text
April 1 UTC
```

---

## Environment

The private `.env` file should not be committed.

Example:

```bash
HELIUS_DEVNET_RPC="https://devnet.helius-rpc.com/?api-key=YOUR_KEY"
HELIUS_MAINNET_RPC="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
ANCHOR_WALLET="$HOME/.config/solana/id.json"
```

Load environment variables:

```bash
set -a
source .env
set +a
```

Confirm:

```bash
echo $HELIUS_DEVNET_RPC
echo $HELIUS_MAINNET_RPC
solana address -k ~/.config/solana/id.json
```

If an RPC key is accidentally pasted into a public log, rotate the key immediately.

---

## Keypair Safety

Do not commit deploy keypairs.

The following must remain ignored:

```text
target/deploy/*.json
*.keypair.json
.env
.env.*
```

Before committing, verify:

```bash
git ls-files | grep -E "target/deploy|keypair|id.json|\.env$"
```

Expected result:

```text
No local keypairs or private environment files should appear.
```

---

## Localnet

Start Surfpool:

```bash
surfpool start
```

Build and deploy:

```bash
anchor build
anchor program deploy target/deploy/physis_epoch_registry.so
```

Initialize, register, inspect, activate, and inspect again:

```bash
yarn script:init:local
yarn script:epoch:local
yarn script:status:local
yarn script:activate:local
yarn script:status:local
```

Expected localnet result:

```text
Registry initialized.
Current Physis epoch registered.
Epoch activated.
Registry currentEpoch points to the active PhysisEpoch account.
Epoch status = 1.
```

If Surfpool is restarted, local accounts are reset. Re-run the full flow:

```bash
anchor build
anchor program deploy target/deploy/physis_epoch_registry.so
yarn script:init:local
yarn script:epoch:local
yarn script:status:local
yarn script:activate:local
yarn script:status:local
```

For `anchor test`, Anchor can spawn the test environment automatically.

---

## Tests

Before any deployment:

```bash
cargo fmt
anchor build
anchor test
```

Expected result:

```text
14 passing
```

Current test coverage includes:

```text
initialize registry
register valid epoch
pause/resume registry
activate epoch after start time
close active epoch after end time
reject wrong authority
reject invalid epoch id
reject invalid calendar quarter
reject invalid Physis quarter
reject invalid timestamps
reject register while paused
reject activate before start time
reject close before end time
reject activating a second epoch while one is active
```

---

## Devnet

Load private RPC environment:

```bash
set -a
source .env
set +a
```

Confirm the devnet RPC is loaded:

```bash
echo $HELIUS_DEVNET_RPC
```

Build and deploy:

```bash
anchor build
anchor program deploy target/deploy/physis_epoch_registry.so \
  --provider.cluster "$HELIUS_DEVNET_RPC" \
  --provider.wallet ~/.config/solana/id.json
```

Initialize, register, inspect, activate, and inspect again:

```bash
yarn script:init:devnet
yarn script:epoch:devnet
yarn script:status:devnet
yarn script:activate:devnet
yarn script:status:devnet
```

Expected devnet result:

```text
Registry initialized.
Current Physis epoch registered.
Epoch activated.
Registry currentEpoch points to the active PhysisEpoch account.
Epoch status = 1.
```

---

## Devnet Program State

Program ID:

```text
PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

Registry PDA:

```text
EeNBPkMCnahfjvc44qjFpSgxDyJrHZv9ASSX5fSm9crm
```

Current Epoch PDA:

```text
3gfc4aBN4goAfZj4eWKmCA9ukp4ECyw2Z93xDmXL1T4i
```

Current Epoch ID:

```text
202602
```

Current Devnet Authority:

```text
wfSXjyiLAv2mmCyPBhgT5ZNaPtAenNjQ6jaanQpdJJm
```

Devnet authority is a developer wallet for testing only.

---

## Mainnet Deployment Requirements

Mainnet deployment should not proceed until:

```text
1. Program builds and tests pass.
2. Full Realms Main/Council authority is verified.
3. Program upgrade authority handoff path is defined.
4. Registry admin authority target is DAO-controlled.
5. Program ID, IDL hash, source commit hash, and verified hash are documented.
6. Deployment wallet and funding path are confirmed.
7. GitHub repo is public and current source is pushed.
8. Mainnet registry initialization transaction is reviewed before execution.
```

---

## Mainnet Authority Principle

Production authority should follow this path:

```text
Physis Realm / Realms Governance
→ Main/Council governed authority
→ Orrery program administration
```

No founder wallet or individual developer wallet should permanently control production registry authority.

Initial mainnet deployment may use a developer wallet as temporary upgrade authority, matching the Realms program-ownership process:

```text
Deploy with developer wallet
→ verify program
→ transfer upgrade authority to DAO through Realms
```

Target DAO authority:

```text
6ZuPrCK472jw3ZjRBqa6PZQ1tyVvY5BuYfWS7GMq7hX8
```

---

## Mainnet Deployment: Program Binary

Load environment:

```bash
set -a
source .env
set +a
```

Confirm wallet and balance:

```bash
solana address -k ~/.config/solana/id.json
solana balance --url "$HELIUS_MAINNET_RPC"
```

Build and test:

```bash
cargo fmt
anchor build
anchor test
```

Deploy the program with the vanity program ID:

```bash
solana program deploy target/deploy/physis_epoch_registry.so \
  --program-id target/deploy/physis_epoch_registry-keypair.json \
  --url "$HELIUS_MAINNET_RPC" \
  --keypair ~/.config/solana/id.json
```

Verify program account:

```bash
solana program show PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --url "$HELIUS_MAINNET_RPC"
```

Expected immediately after initial mainnet deployment:

```text
Program exists on mainnet.
Program is upgradeable.
Upgrade authority is the developer deploy wallet.
Registry is not initialized yet.
```

Do not initialize the mainnet registry from the developer wallet.

---

## Verified Build Configuration

Root `Cargo.toml` should include deterministic release settings:

```toml
[workspace]
members = [
  "programs/physis_epoch_registry"
]
resolver = "2"

[workspace.dependencies]
anchor-lang = "1.1.2"

[workspace.metadata.cli]
solana = "4.0.0"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
```

The program `Cargo.toml` should not include a direct `solana-program` dependency unless absolutely required. Anchor warns that direct `solana-program` dependencies can cause conflicts.

Program `Cargo.toml` dependency section:

```toml
[dependencies]
anchor-lang = { workspace = true }
solana-security-txt = "1.1.3"
```

---

## Verified Build: Apple Silicon / Docker

On Apple Silicon, use:

```bash
export DOCKER_DEFAULT_PLATFORM=linux/amd64
```

The verifiable build Docker process can be slow because it uses amd64 emulation.

The working Solana verified-build image was:

```text
solanafoundation/solana-verifiable-build:4.0.0
```

If `solana-verify build` reports no compatible Docker image, use the explicit base image.

---

## Verified Build: Build and Deploy

Build verifiably:

```bash
export DOCKER_DEFAULT_PLATFORM=linux/amd64

solana-verify build \
  --library-name physis_epoch_registry \
  --base-image solanafoundation/solana-verifiable-build:4.0.0
```

Important:

```text
Do not run a normal anchor build after the verifiable build and before deploy.
Deploy the exact .so produced by the verifiable build.
```

Deploy the verified artifact:

```bash
solana program deploy \
  -u "$HELIUS_MAINNET_RPC" \
  target/deploy/physis_epoch_registry.so \
  --program-id target/deploy/physis_epoch_registry-keypair.json \
  --with-compute-unit-price 50000 \
  --max-sign-attempts 100 \
  --use-rpc \
  --keypair ~/.config/solana/id.json
```

---

## Verified Build: Hash Checks

Get local executable hash:

```bash
solana-verify get-executable-hash target/deploy/physis_epoch_registry.so
```

Get on-chain program hash:

```bash
solana-verify get-program-hash \
  -u "$HELIUS_MAINNET_RPC" \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

Both hashes should match.

Known verified hash:

```text
7d19d0556c0f081c7641a164a08c30f3991f8f7400eb8c2709ce5291a3fa46a8
```

---

## Verified Build: Repository Verification

Commit and push the exact source state before repo verification:

```bash
git status
git add .
git commit -m "Prepare verified Orrery epoch registry build"
git push
```

Verify from the public repo:

```bash
solana-verify verify-from-repo \
  -u "$HELIUS_MAINNET_RPC" \
  --program-id PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  https://github.com/PhysisVerse/physis-orrery \
  --commit-hash "$(git rev-parse HEAD)" \
  --library-name physis_epoch_registry \
  --mount-path . \
  --base-image solanafoundation/solana-verifiable-build:4.0.0
```

When prompted to upload verification data on-chain:

```text
y
```

The `--base-image` flag is important. Without it, the remote verification job may fail because the remote service may not automatically resolve the correct Docker image for Solana `4.0.0`.

---

## Verified Build: Remote Job

Submit the remote verification job:

```bash
solana-verify remote submit-job \
  -u "$HELIUS_MAINNET_RPC" \
  --program-id PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --uploader "$(solana address -k ~/.config/solana/id.json)"
```

Known successful job:

```text
25cf187c-a3ad-499d-aeeb-ded0d6e1d4d7
```

Verification status URL:

```text
https://verify.osec.io/status/PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

Job URL:

```text
https://verify.osec.io/job/25cf187c-a3ad-499d-aeeb-ded0d6e1d4d7
```

Known successful verification result:

```text
Program has been verified.
The provided GitHub build matches the on-chain hash.

On Chain Hash:
7d19d0556c0f081c7641a164a08c30f3991f8f7400eb8c2709ce5291a3fa46a8

Executable Hash:
7d19d0556c0f081c7641a164a08c30f3991f8f7400eb8c2709ce5291a3fa46a8
```

---

## Security Metadata

The program embeds security metadata using:

```text
solana-security-txt
```

GitHub security policy path:

```text
.github/SECURITY.md
```

Security metadata JSON path:

```text
metadata/security.json
```

Security metadata URL:

```text
https://cdn.jsdelivr.net/gh/PhysisVerse/physis-orrery@main/metadata/security.json
```

The direct Program Metadata CLI execution path failed with:

```text
[Error] The provided transaction plan failed to execute.
```

The reliable path was:

```text
export transaction
→ send exported transaction with local script
```

Export security metadata transaction:

```bash
npx @solana-program/program-metadata@0.7.0 write security \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --url "https://cdn.jsdelivr.net/gh/PhysisVerse/physis-orrery@main/metadata/security.json" \
  --keypair ~/.config/solana/id.json \
  --payer ~/.config/solana/id.json \
  --rpc "$HELIUS_MAINNET_RPC" \
  --export \
  --export-encoding base64 > /tmp/physis-orrery-security-metadata.b64
```

Send exported transaction:

```bash
set -a
source .env
set +a

yarn tsx scripts/tools/send-exported-base64-tx.ts /tmp/physis-orrery-security-metadata.b64
```

Fetch security metadata:

```bash
npx @solana-program/program-metadata@0.7.0 fetch security \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --rpc "$HELIUS_MAINNET_RPC"
```

---

## Program Metadata IDL

Traditional Anchor IDL and Program Metadata IDL are separate systems.

```text
Anchor IDL:
Traditional Anchor-specific IDL account.

Program Metadata IDL:
Newer/general program metadata path under seed `idl`.
```

Program Metadata IDL was uploaded using a URL-backed metadata pointer.

Public IDL path:

```text
idls/physis_epoch_registry.json
```

Public IDL URL:

```text
https://cdn.jsdelivr.net/gh/PhysisVerse/physis-orrery@main/idls/physis_epoch_registry.json
```

Export Program Metadata IDL transaction:

```bash
npx @solana-program/program-metadata@0.7.0 write idl \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --url "https://cdn.jsdelivr.net/gh/PhysisVerse/physis-orrery@main/idls/physis_epoch_registry.json" \
  --keypair ~/.config/solana/id.json \
  --payer ~/.config/solana/id.json \
  --rpc "$HELIUS_MAINNET_RPC" \
  --export \
  --export-encoding base64 > /tmp/physis-orrery-idl-url-metadata.b64
```

Send exported transaction:

```bash
set -a
source .env
set +a

yarn tsx scripts/tools/send-exported-base64-tx.ts /tmp/physis-orrery-idl-url-metadata.b64
```

Fetch Program Metadata IDL:

```bash
npx @solana-program/program-metadata@0.7.0 fetch idl \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --rpc "$HELIUS_MAINNET_RPC"
```

---

## Sending Exported Base64 Transactions

The helper script supports both single-line and multi-line exports.

Script:

```text
scripts/tools/send-exported-base64-tx.ts
```

Single-line export:

```text
Sends one payload.
```

Multi-line export:

```text
Sends each base64 payload sequentially.
```

This was needed because Program Metadata CLI direct execution failed, while `--export` produced valid payloads.

For metadata exports, if the output file includes log lines, clean it first:

```bash
grep -E '^[A-Za-z0-9+/=]+$' /tmp/input.b64 > /tmp/clean.b64
```

Then send:

```bash
yarn tsx scripts/tools/send-exported-base64-tx.ts /tmp/clean.b64
```

---

## Anchor IDL

Check traditional Anchor IDL:

```bash
anchor idl fetch \
  --provider.cluster "$HELIUS_MAINNET_RPC" \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

If missing:

```bash
anchor idl init \
  --filepath target/idl/physis_epoch_registry.json \
  --provider.cluster "$HELIUS_MAINNET_RPC" \
  --provider.wallet ~/.config/solana/id.json \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

If already initialized:

```bash
anchor idl upgrade \
  --filepath target/idl/physis_epoch_registry.json \
  --provider.cluster "$HELIUS_MAINNET_RPC" \
  --provider.wallet ~/.config/solana/id.json \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

Some explorers may still show IDL unavailable if they only index one IDL standard or have not refreshed yet.

---

## DAO Authority Handoff

After verification and metadata are complete, transfer upgrade authority through Realms.

Transfer from developer wallet:

```text
wfSXjyiLAv2mmCyPBhgT5ZNaPtAenNjQ6jaanQpdJJm
```

Transfer to DAO-controlled authority:

```text
6ZuPrCK472jw3ZjRBqa6PZQ1tyVvY5BuYfWS7GMq7hX8
```

This should be done through Realms’ Programs flow or equivalent governance proposal.

After transfer, verify:

```bash
solana program show PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --url "$HELIUS_MAINNET_RPC"
```

Expected authority after handoff:

```text
6ZuPrCK472jw3ZjRBqa6PZQ1tyVvY5BuYfWS7GMq7hX8
```

---

## Mainnet Registry Initialization

Do not initialize the mainnet registry from the developer wallet.

Mainnet registry initialization should be done through Realms custom instructions.

Required instructions:

```text
initialize_registry
register_epoch
activate_epoch
```

Target registry authority:

```text
6ZuPrCK472jw3ZjRBqa6PZQ1tyVvY5BuYfWS7GMq7hX8
```

Target realm:

```text
DsWWtZrqXBcqTTPoEyFH793Euq82r95CuXWTwqo3JZur
```

The mainnet registry should be initialized with:

```text
registry.realm =
DsWWtZrqXBcqTTPoEyFH793Euq82r95CuXWTwqo3JZur

registry.authority =
6ZuPrCK472jw3ZjRBqa6PZQ1tyVvY5BuYfWS7GMq7hX8
```

---

## Notes

`anchor deploy` is deprecated. Prefer:

```bash
anchor program deploy target/deploy/physis_epoch_registry.so
```

For devnet/mainnet with explicit RPC:

```bash
anchor program deploy target/deploy/physis_epoch_registry.so \
  --provider.cluster "$HELIUS_DEVNET_RPC" \
  --provider.wallet ~/.config/solana/id.json
```

For final verified mainnet deployment, prefer:

```bash
solana program deploy \
  -u "$HELIUS_MAINNET_RPC" \
  target/deploy/physis_epoch_registry.so \
  --program-id target/deploy/physis_epoch_registry-keypair.json \
  --with-compute-unit-price 50000 \
  --max-sign-attempts 100 \
  --use-rpc \
  --keypair ~/.config/solana/id.json
```

For local standalone scripts, Surfpool must already be running:

```bash
surfpool start
```

For `anchor test`, Anchor can spawn the test environment automatically.

---

## Known Explorer Lag / Display Issues

Explorers may take time to reflect:

```text
security.txt
Program Metadata security
Program Metadata IDL
Anchor IDL
verified build status
```

Use CLI/source-of-truth checks first:

```bash
solana-verify get-program-hash \
  -u "$HELIUS_MAINNET_RPC" \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE

npx @solana-program/program-metadata@0.7.0 fetch security \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --rpc "$HELIUS_MAINNET_RPC"

npx @solana-program/program-metadata@0.7.0 fetch idl \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE \
  --rpc "$HELIUS_MAINNET_RPC"

anchor idl fetch \
  --provider.cluster "$HELIUS_MAINNET_RPC" \
  PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```
