# Orrery Program Registry

## Program 1: Physis Epoch Registry

Program name:

```text
physis_epoch_registry
```

Program ID:

```text
PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE
```

Purpose:

```text
Canonical Physis epoch clock and ASTRALIS service epoch anchor.
```

## Current Devnet State

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

Status:

```text
1 = Active
```

Physis Year:

```text
2026
```

Physis Quarter:

```text
Q2
```

Calendar Year:

```text
2026
```

Calendar Quarter:

```text
Q3
```

Start Unix:

```text
1782864000
```

End Unix:

```text
1790812799
```

ASTRALIS Epoch Zero:

```text
1725148800
```

ASTRALIS Epoch Duration:

```text
21600 seconds
```

## Current Devnet Authority

```text
wfSXjyiLAv2mmCyPBhgT5ZNaPtAenNjQ6jaanQpdJJm
```

## Production Authority Target

```text
Physis DAO / Realms Main-Council governed authority.
```

## Notes

```text
Devnet authority is currently a developer wallet.

Mainnet registry authority should not be a founder/developer wallet.

Before mainnet deployment, the full Realms Main/Council authority path must be verified and documented.
```

## Program Responsibilities

The Physis Epoch Registry is responsible for:

```text
Initializing the global Physis epoch registry
Registering quarterly Physis epochs
Activating epochs
Closing epochs
Pausing/resuming registry operations
Preserving the ASTRALIS 6-hour service epoch anchor
Exposing canonical epoch state to future Physis programs
```

The Physis Epoch Registry is not responsible for:

```text
PHY locking
Reward calculations
Reward claims
PRIVÉ eligibility
Council payments
ASTRALIS leader rotation
SmartSpot uptime
Operator emissions
Token minting
```

## Time Model

Canonical on-chain time:

```text
Solana Clock.unix_timestamp
```

Audit/checkpoint metadata:

```text
Solana slot
Solana epoch
```

Physis year start:

```text
April 1 UTC
```

Physis quarters:

```text
Physis Q1 = April – June
Physis Q2 = July – September
Physis Q3 = October – December
Physis Q4 = January – March
```

ASTRALIS service epoch formula:

```text
astralis_epoch_index =
floor((current_unix_timestamp - astralis_epoch_zero_ts) / astralis_epoch_duration_seconds)
```

With:

```text
astralis_epoch_zero_ts = 1725148800
astralis_epoch_duration_seconds = 21600
```
