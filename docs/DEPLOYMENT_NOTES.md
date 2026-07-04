# Orrery Deployment Notes

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

## Mainnet Deployment Requirements

Mainnet deployment should not proceed until:

```text
1. Full Realms Main/Council authority is verified.
2. Program upgrade authority handoff path is defined.
3. Registry admin authority is DAO-controlled.
4. Mainnet initialization instructions are generated for Realms execution.
5. Program ID, IDL hash, and source commit hash are documented.
6. Deployment wallet and funding path are confirmed.
7. Mainnet registry initialization transaction is reviewed before execution.
```

## Mainnet Authority Principle

Production authority should follow this path:

```text
Physis Realm / Realms Governance
→ Main/Council governed authority
→ Orrery program administration
```

No founder wallet or individual developer wallet should permanently control production registry authority.

## Keypair Safety

Do not commit deploy keypairs.

The following should remain ignored:

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

For local standalone scripts, Surfpool must already be running:

```bash
surfpool start
```

For `anchor test`, Anchor can spawn the test environment automatically.
