<p align="center">
  <img src="./assets/orrery.png" alt="Physis Orrery" width="720" />
</p>

# Physis Orrery

**Orrery** is the on-chain program suite for Physis DAO governance, epoch timing, rewards infrastructure, and ASTRALIS network coordination.

The name reflects the role of this repository: a coordinated system of protocol “bodies” moving through governed cycles — epochs, locks, rewards, eligibility, and future node/service rotations.

---

## Overview

`physis-orrery` is an Anchor workspace containing Physis on-chain programs.

The first program is:

```text
physis_epoch_registry
```

It defines the canonical Physis epoch clock used by future governance, rewards, and network programs.

Orrery is designed to support:

```text
Physis DAO governance
PHY Governance Lock
Foundry Rewards
PRIVÉ-gated community participation
Council stewardship rewards
PHYPRIL annual cycle
ASTRALIS service epochs
SmartSpot / operator rewards
Circuit-breaker protections
```

---

## Repository Status

Current status:

```text
Program 1: Physis Epoch Registry
Status: Initial implementation / local build phase
```

Not yet implemented:

```text
Persona / PRIVÉ Eligibility Registry
PHY Governance Lock
Foundry Rewards Distributor
ASTRALIS Operator Rewards
Circuit Breaker Program
```

---

## Known Physis Constants

```text
Physis Realm:
DsWWtZrqXBcqTTPoEyFH793Euq82r95CuXWTwqo3JZur

PHY Mint:
EswgBj2hZKdgovX2ihWSUDnuBg9VNbGmSGoH5yjNsPRa

ASTRALIS Mint:
ASTRALvKjGK2xk2pamjMBU5dav5cEQa6zpKCP6FZ7BAJ
```

ASTRALIS service epoch anchor:

```text
ASTRALIS Epoch Zero:
2024-09-01T00:00:00Z

Unix Timestamp:
1725148800

ASTRALIS Epoch Duration:
21600 seconds

Duration:
6 hours
```

Physis annual/rewards cycle:

```text
Physis Year Start:
April 1 UTC

Physis Q1:
April – June

Physis Q2:
July – September

Physis Q3:
October – December

Physis Q4:
January – March
```

PHYPRIL is the annual Physis cycle anchor beginning April 1.

---

## Program Order

The intended program development order is:

```text
1. Physis Epoch Registry
2. Persona / PRIVÉ Eligibility Registry
3. PHY Governance Lock + Realms Voter Weight
4. Foundry Rewards Distributor
5. Off-chain Epoch Indexer / Merkle Builder
6. Foundry Portal Integration
7. ASTRALIS Operator Rewards
8. Dedicated Circuit Breaker Program
```

The first deployment target is:

```text
physis_epoch_registry
```

---

## Current Program: Physis Epoch Registry

Program directory:

```text
programs/physis_epoch_registry
```

Purpose:

```text
Canonical Physis time registry.
```

Responsibilities:

```text
Initialize the global Physis epoch registry
Register quarterly Physis epochs
Activate epochs
Close epochs
Pause/resume registry operations
Preserve the ASTRALIS 6-hour service epoch anchor
Expose canonical epoch state to future Physis programs
```

The Epoch Registry does **not** handle:

```text
PHY locking
reward calculations
reward claims
PRIVÉ eligibility
Council payments
ASTRALIS leader rotation
SmartSpot uptime
operator emissions
token minting
```

Those are separate future programs/modules.

---

## Time Model

Orrery uses **Unix seconds** as canonical on-chain time.

On-chain time source:

```text
Solana Clock.unix_timestamp
```

Audit/checkpoint metadata:

```text
Solana slot
Solana epoch
```

Frontend applications may use JavaScript milliseconds for display, but all on-chain inputs and account fields should use Unix seconds.

Conversion rule:

```ts
const unixSeconds = Math.floor(Date.now() / 1000);
const jsMilliseconds = unixSeconds * 1000;
```

---

## Epoch Types

Orrery distinguishes between two epoch systems:

### Physis Epoch

Quarterly governance, rewards, release, and PHYPRIL cycle.

Example:

```text
Calendar Q3 2026:
2026-07-01T00:00:00Z to 2026-09-30T23:59:59Z

Physis Year 2026:
Physis Q2
```

### ASTRALIS Service Epoch

6-hour operational service epoch used later for SmartSpot/node activity, leader rotation, uptime scoring, and network rewards.

Formula:

```text
astralis_epoch_index =
floor((current_unix_timestamp - astralis_epoch_zero_ts) / astralis_epoch_duration_seconds)
```

With:

```text
astralis_epoch_zero_ts = 1725148800
astralis_epoch_duration_seconds = 21600
```

The Epoch Registry stores the ASTRALIS anchor but does not create an account for every 6-hour epoch.

---

## Authority Model

Production authority should be controlled by the Physis DAO through Realms.

Intended authority path:

```text
Physis Realm / Realms Governance
→ Main/Council governed authority
→ Orrery program administration
```

No founder wallet or individual keypair should permanently control production program authority.

For local development, temporary developer keypairs may be used.

Production authority items to finalize before mainnet:

```text
Full Main/Council governance authority address
Program upgrade authority
Registry admin authority
Treasury/reward authority for later programs
Emergency pause/resume authority
```

---

## Security Design Principles

Orrery is designed around the following principles:

```text
One workspace, multiple focused programs
DAO-controlled authority model
Upgradeable during warm-up, DAO-controlled upgrade authority
Canonical PDA seeds with stored bumps
Versioned account state
Immutable historical epoch boundaries
Unix seconds as canonical time
Solana slot/epoch as audit anchors
Explicit status enums
No global iteration assumptions
Events as first-class indexing signals
Fixed-size accounts where practical
Separate payer from authority
Emergency pause only
ASTRALIS clock anchor only in Program 1
Read-only composability before CPI complexity
```

---

## Program IDs

Program IDs are generated per program.

Preferred vanity format:

```text
PHY...oE
```

for:

```text
physis_epoch_registry
```

Do not commit program keypairs.

---

## Local Development

### Requirements

Expected local stack:

```text
Rust / Cargo
Solana CLI
Anchor CLI
Yarn
```

Current target stack:

```text
anchor-cli: 1.1.2
solana-cli: 4.1.1
```

### Install dependencies

```bash
yarn install
```

### Build

```bash
anchor build
```

### Format

```bash
cargo fmt
```

### Test

```bash
anchor test
```

---

## Important Keypair Warning

Do **not** commit deploy keypairs.

The following should remain ignored:

```text
target/deploy/*.json
*.keypair.json
```

Before committing, verify:

```bash
git status
git ls-files | grep -E "keypair|target/deploy"
```

No local program keypair should appear in tracked files.

---

## Repository Structure

```text
physis-orrery/
├── Anchor.toml
├── Cargo.toml
├── package.json
├── yarn.lock
├── tsconfig.json
├── README.md
├── .gitignore
│
├── programs/
│   └── physis_epoch_registry/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── constants.rs
│           ├── errors.rs
│           ├── events.rs
│           ├── state.rs
│           ├── instructions/
│           │   ├── mod.rs
│           │   ├── initialize_registry.rs
│           │   ├── register_epoch.rs
│           │   ├── activate_epoch.rs
│           │   ├── close_epoch.rs
│           │   ├── pause_registry.rs
│           │   └── resume_registry.rs
│           └── utils/
│               ├── mod.rs
│               └── time.rs
│
├── tests/
│   ├── physis_epoch_registry.spec.ts
│   └── helpers/
│       ├── setup.ts
│       ├── pdas.ts
│       ├── time.ts
│       └── constants.ts
│
├── scripts/
│   ├── localnet/
│   ├── devnet/
│   └── governance/
│
├── idls/
├── docs/
├── configs/
└── packages/
	└── sdk/
```

---

## Programs

### Persona / PRIVÉ Eligibility Registry

Tracks eligibility for PRIVÉ-gated participation and future community governance expansion.

Possible eligibility modes:

```text
PRIVE_ONLY
PRIVE_OR_LOCKED_PHY
LOCKED_PHY_THRESHOLD
OPEN_LOCKED_PHY
OPEN_PHY
DAO_APPROVED_CUSTOM
```

### PHY Governance Lock

PHY lock>gov program.

Responsibilities:

```text
Lock PHY
Track governance lock positions
Expose Realms-compatible voter weight
Support delegation metadata
Enable quarterly reward eligibility
```

No liquid `xPHY` token in v1.

### Foundry Rewards Distributor

Quarterly reward distribution system.

Responsibilities:

```text
Store DAO-approved reward roots
Support multiple reward classes
Allow Merkle-proof claims
Enforce epoch reward pool limits
Support embedded circuit-breaker checks
```

Potential reward classes:

```text
GOVERNANCE_LOCK
COUNCIL_STEWARDSHIP
PRIVE_PARTICIPATION
FOUNDRY_CONTRIBUTION
PHYPRIL_BONUS
```

### ASTRALIS Operator Rewards

Program for SmartSpot/operator/network rewards.

Responsibilities:

```text
SmartSpot registration
ASTRALIS service epochs
Node/operator scoring
Leader rotation roots
ASTRALIS reward distribution
```

### Circuit Breaker

Future reusable safety layer for:

```text
reward vault outflows
token emissions
mint limits
operator reward flows
cross-program treasury safety
```

---

## Governance Philosophy

Physis is designed as a hybrid DAO.

Initial layers:

```text
Council:
Equal-seat governance, high responsibility, execution/security authority.

PRIVÉ:
Initial community governance and participation gate.

Locked PHY:
Governance alignment and future community voting weight.

Broader PHY Community:
Progressive expansion path as the ecosystem matures.
```

Council voting should remain equal-weighted:

```text
1 Council member = 1 Council vote
```

Token-weighted or lock-weighted governance should apply to the community/PHY layer, not to Council seats.

---

## Public Repository

```text
https://github.com/PhysisVerse/physis-orrery
```

---

## License

TBD.
