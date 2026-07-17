# Physis Community Voting Weight

## Status

```text
Architecture decision
```

## Scope

This document defines the community voting-weight algorithm for the Physis DAO.

The algorithm combines:

```text
PRIVÉ governance admission
+
qualifying locked PHY
+
geometrically diminishing voting influence
```

It is intended for implementation by the future:

```text
physis_governance_composer
```

The Governance Composer will produce the final Realms-compatible community `VoterWeightRecord`.

This algorithm is **not** implemented by the Physis Eligibility Registry itself.

---

## Architectural Responsibilities

### Physis Eligibility Registry

Program:

```text
physis_eligibility_registry
```

Responsibility:

```text
Determine whether a wallet has an Active PRIVE_MEMBER eligibility record.
```

It does not calculate voting weight.

### PHY Lock / Voter Stake Registry

Responsibility:

```text
Hold or verify qualifying locked PHY positions.
Expose the qualifying locked PHY amount for a governance identity.
```

It does not independently determine final Physis community voting power.

### Streamflow Vesting Adapter

Responsibility:

```text
Verify approved legacy Streamflow PHY vesting contracts.
Calculate the amount that remains genuinely locked or unvested.
```

It does not independently determine final Physis community voting power.

### Physis Governance Composer

Responsibility:

```text
Verify PRIVÉ admission.
Aggregate qualifying locked PHY.
Apply the geometric voting algorithm.
Write the final Realms VoterWeightRecord.
```

### Realms

Responsibility:

```text
Consume the final VoterWeightRecord.
Manage proposals, voting, thresholds, quorum and execution.
```

Council voting remains separate and native to Realms.

---

## Governance Policy

The Physis community governance model follows these rules:

```text
1. Active PRIVÉ membership is required for community governance.

2. An Active PRIVÉ member receives one base community vote.

3. Qualifying locked PHY grants additional community votes.

4. Additional voting power grows geometrically rather than linearly.

5. Each additional vote requires substantially more locked PHY than the prior vote.

6. There is no arbitrary per-wallet voting cap.

7. The finite PHY supply creates a natural mathematical upper bound.

8. A wallet without Active PRIVÉ membership receives zero governance weight,
   regardless of how much PHY it locks.

9. Non-PRIVÉ wallets may still lock PHY and receive applicable lock rewards.

10. Rewards and governance voting weight use separate economic formulas.
```

---

## Definitions

Let:

```math
P \in \{0,1\}
```

represent the wallet’s active PRIVÉ governance status:

```math
P =
\begin{cases}
1, & \text{if the wallet has an Active PRIVÉ governance membership},\\
0, & \text{otherwise}.
\end{cases}
```

Let:

```math
L \geq 0
```

be the wallet’s total qualifying locked PHY, expressed in whole PHY.

Qualifying locked PHY may include:

```text
Active governance-eligible VSR positions
Approved legacy Streamflow vesting positions
Other future DAO-approved lock sources
```

Qualifying locked PHY must exclude:

```text
Liquid wallet balances
Expired locks
Already vested and immediately withdrawable amounts
Closed or cancelled vesting contracts
Unapproved vesting contracts
Positions belonging to another governance identity
Positions still inside a governance warm-up period
Amounts already counted through another source
```

---

## Policy Constants

The initial algorithm uses:

```math
T_1 = 30{,}000
```

for the first locked-PHY bonus vote.

The second bonus threshold is:

```math
T_2 = 300{,}000
```

Every subsequent threshold is multiplied by:

```math
r = 3
```

Therefore, for every integer $n \geq 2$:

```math
T_n = 300{,}000 \cdot 3^{n-2}
```

where:

```text
T_n = minimum qualifying locked PHY required for n bonus votes
```

---

## Locked-PHY Bonus Function

The locked-PHY bonus vote function is:

```math
B(L)=
\begin{cases}
0,
& 0 \leq L < 30{,}000,\\[6pt]

1,
& 30{,}000 \leq L < 300{,}000,\\[6pt]

2+\left\lfloor
\log_{3}\left(\dfrac{L}{300{,}000}\right)
\right\rfloor,
& L \geq 300{,}000.
\end{cases}
```

Where:

```text
B(L) = additional votes produced by qualifying locked PHY
```

The logarithm is a mathematical specification only.

The on-chain Rust implementation must use integer comparisons and repeated threshold multiplication. It must not use floating-point arithmetic.

---

## Final Community Voting Weight

The final community voting weight is:

```math
\boxed{
V(P,L)=P\left(1+B(L)\right)
}
```

Where:

```text
V(P,L) = final community voting weight
P      = Active PRIVÉ membership indicator
L      = qualifying locked PHY
B(L)   = locked-PHY bonus votes
```

### No Active PRIVÉ Membership

If:

```math
P=0
```

then:

```math
V(0,L)=0
```

for every possible locked-PHY amount $L$.

Therefore:

```math
\boxed{
P=0 \implies V=0
}
```

PHY ownership or locking alone cannot create community governance power.

### Active PRIVÉ Membership

If:

```math
P=1
```

then:

```math
V(1,L)=1+B(L)
```

The first vote is the PRIVÉ membership vote.

All additional votes derive from qualifying locked PHY.

---

## Equivalent Threshold Definition

The bonus function may also be expressed without logarithms.

Define the threshold sequence:

```math
T_n=
\begin{cases}
30{,}000, & n=1,\\[6pt]
300{,}000\cdot 3^{n-2}, & n\geq 2.
\end{cases}
```

Then the locked-PHY bonus is:

```math
B(L)=
\begin{cases}
0, & L<T_1,\\[6pt]
\max\left\{
n\in\mathbb{N}_{\geq 1}
\;\middle|\;
L\geq T_n
\right\}, & L\geq T_1.
\end{cases}
```

This threshold definition corresponds directly to the intended integer-only Rust implementation.

---

## Voting-Weight Ladder

| Qualifying locked PHY | PHY bonus | Total votes with Active PRIVÉ |
|---:|---:|---:|
| `0–29,999` | `+0` | `1` |
| `30,000–299,999` | `+1` | `2` |
| `300,000–899,999` | `+2` | `3` |
| `900,000–2,699,999` | `+3` | `4` |
| `2,700,000–8,099,999` | `+4` | `5` |
| `8,100,000–24,299,999` | `+5` | `6` |
| `24,300,000–72,899,999` | `+6` | `7` |
| `72,900,000–218,699,999` | `+7` | `8` |
| `218,700,000–656,099,999` | `+8` | `9` |
| `656,100,000–1,968,299,999` | `+9` | `10` |
| `1,968,300,000–3,000,000,000` | `+10` | `11` |

The next theoretical threshold would be:

```math
300{,}000\cdot3^9
=
5{,}904{,}900{,}000
```

This exceeds the Physis protocol PHY supply cap.

---

## PHY Supply Bound

The Physis protocol defines the maximum PHY supply as:

```math
S_{\max}=3{,}000{,}000{,}000
```

At the maximum possible locked amount:

```math
L=S_{\max}
```

the locked-PHY bonus is:

```math
B(3{,}000{,}000{,}000)
=
2+
\left\lfloor
\log_3
\left(
\dfrac{3{,}000{,}000{,}000}{300{,}000}
\right)
\right\rfloor
```

```math
=
2+\left\lfloor\log_3(10{,}000)\right\rfloor
```

```math
=
2+8
```

```math
=
10
```

Therefore, the theoretical maximum voting weight for one Active PRIVÉ governance identity is:

```math
\boxed{
V_{\max}=1+10=11
}
```

This result requires at least:

```math
1{,}968{,}300{,}000\ \mathrm{PHY}
```

to be held in qualifying locked positions by one admitted governance identity.

The next vote would require:

```math
5{,}904{,}900{,}000\ \mathrm{PHY}
```

which is greater than the entire protocol supply.

The effective upper bound therefore arises from the finite PHY supply rather than an arbitrary per-wallet cap.

### Supply Enforcement Requirement

The implementation must calculate system limits from an enforced protocol supply bound.

The value:

```text
3,000,000,000 PHY
```

must correspond to the actual governed or technically enforced maximum supply. It must not be treated as a UI-only assumption.

---

## Marginal Cost of Additional Votes

The total threshold for bonus vote $n$ is:

```math
T_n=300{,}000\cdot3^{n-2}
\qquad (n\geq2)
```

The additional PHY required to advance from bonus vote $n-1$ to bonus vote $n$ is:

```math
\Delta T_n=T_n-T_{n-1}
```

For $n\geq3$:

```math
\Delta T_n
=
300{,}000\cdot3^{n-2}
-
300{,}000\cdot3^{n-3}
```

```math
=
600{,}000\cdot3^{n-3}
```

This creates sharply increasing marginal costs.

| Bonus vote reached | Total threshold | Additional PHY from prior tier |
|---:|---:|---:|
| `+1` | `30,000` | `30,000` |
| `+2` | `300,000` | `270,000` |
| `+3` | `900,000` | `600,000` |
| `+4` | `2,700,000` | `1,800,000` |
| `+5` | `8,100,000` | `5,400,000` |
| `+6` | `24,300,000` | `16,200,000` |
| `+7` | `72,900,000` | `48,600,000` |
| `+8` | `218,700,000` | `145,800,000` |
| `+9` | `656,100,000` | `437,400,000` |
| `+10` | `1,968,300,000` | `1,312,200,000` |

This recognizes larger long-term commitments while ensuring that influence grows far more slowly than locked capital.

---

## Security Properties

### PRIVÉ Admission Gate

```math
P=0 \implies V=0
```

A participant cannot purchase governance power using PHY alone.

### Diminishing Political Returns

For large $L$, voting power grows logarithmically:

```math
V(1,L)=O(\log_3 L)
```

Locked capital grows exponentially between voting tiers, while voting influence increases by only one unit at each threshold.

### No Linear Whale Voting

The algorithm does not use:

```math
V \propto L
```

A wallet locking ten times more PHY does not automatically receive ten times more voting power.

### Finite Natural Maximum

Because:

```math
L\leq S_{\max}
```

the voting weight has a finite natural maximum even though no arbitrary wallet-level cap is configured.

### Rewards Remain Independent

Governance voting weight and lock rewards must remain separate.

Conceptually:

```math
\text{Governance Weight}
=
\text{discrete geometric function of qualifying locked PHY}
```

while:

```math
\text{Lock Rewards}
=
\text{separately governed economic function}
```

Large stakeholders may receive economic rewards proportionate to their qualifying positions without receiving proportional political control.

---

## Governance Identity Rules

The algorithm assumes:

```text
One verified Persona
→ one Active PRIVÉ governance identity
→ one final community VoterWeightRecord
```

The implementation must prevent:

```text
One person activating multiple PRIVÉ governance identities
One lock position being counted by multiple wallets
One position being counted through both VSR and Streamflow
Delegated positions being counted for both delegator and delegate
Transferred PRIVÉ NFTs instantly creating duplicate voting identities
Multiple PRIVÉ NFTs in one wallet producing multiple base votes
```

Multiple qualifying PRIVÉ NFTs associated with one governance identity must still produce:

```math
P=1
```

not:

```math
P>1
```

---

## Qualifying Locked PHY

Let the complete set of approved lock sources be:

```math
\mathcal{S}
```

For each source $s\in\mathcal{S}$, let:

```math
L_s
```

be the amount of PHY that source proves is currently eligible for governance.

Then:

```math
L=\sum_{s\in\mathcal{S}}L_s
```

subject to the invariant that no underlying tokens are counted more than once.

The Governance Composer must verify:

```text
Correct PHY mint
Correct governance identity
Correct lock ownership or beneficiary
Lock is active
Required warm-up has completed
Required remaining duration is satisfied
Position is not expired
Position is not closed or cancelled
Amount is not presently withdrawable if policy excludes withdrawable PHY
Position has not already been counted through another source
```

---

## Streamflow Calculation Rule

For an approved Streamflow vesting position, governance weight should use only the amount that remains genuinely locked or unvested.

Conceptually:

```math
L_{\text{Streamflow}}
=
A_{\text{entitlement}}
-
A_{\text{withdrawn}}
-
A_{\text{currently claimable}}
```

Where:

```text
A_entitlement         = total beneficiary entitlement
A_withdrawn           = amount already withdrawn
A_currently claimable = vested amount available for immediate withdrawal
```

A token must not count as governance-locked merely because the recipient has not yet withdrawn an already vested amount.

---

## Integer-Only Reference Algorithm

The on-chain implementation must not calculate logarithms or use floating-point arithmetic.

A reference implementation using whole PHY is:

```rust
/// Calculates locked-PHY bonus votes.
///
/// Policy:
/// - Below 30,000 PHY: zero bonus votes.
/// - At least 30,000 PHY: one bonus vote.
/// - At least 300,000 PHY: two bonus votes.
/// - Every later threshold is three times the prior threshold.
pub fn locked_phy_bonus_votes(locked_phy: u128) -> u64 {
	const FIRST_THRESHOLD: u128 = 30_000;
	const GEOMETRIC_START: u128 = 300_000;
	const MULTIPLIER: u128 = 3;

	if locked_phy < FIRST_THRESHOLD {
		return 0;
	}

	if locked_phy < GEOMETRIC_START {
		return 1;
	}

	let mut bonus_votes: u64 = 2;
	let mut threshold: u128 = GEOMETRIC_START;

	// Equivalent to:
	//
	// 2 + floor(log_3(locked_phy / GEOMETRIC_START))
	//
	// Division is used in the condition to avoid multiplication overflow.
	while threshold <= locked_phy / MULTIPLIER {
		threshold *= MULTIPLIER;

		bonus_votes = bonus_votes
			.checked_add(1)
			.expect("bonus vote overflow");
	}

	bonus_votes
}
```

The final voting-weight calculation is:

```rust
/// Calculates final Physis community voting weight.
///
/// A wallet without Active PRIVÉ governance membership always receives zero
/// voting weight, regardless of its locked-PHY amount.
pub fn community_voter_weight(
	has_active_prive_membership: bool,
	qualifying_locked_phy: u128,
) -> u64 {
	if !has_active_prive_membership {
		return 0;
	}

	const BASE_PRIVE_VOTE: u64 = 1;

	BASE_PRIVE_VOTE
		.checked_add(locked_phy_bonus_votes(qualifying_locked_phy))
		.expect("community voter-weight overflow")
}
```

---

## Raw Token-Unit Implementation

Production code must operate on raw PHY base units.

Let:

```math
d
```

be the PHY mint decimal count.

Then one whole PHY is:

```math
U=10^d
```

raw units.

The raw thresholds are:

```math
T_{1,\mathrm{raw}}=30{,}000\cdot U
```

and:

```math
T_{2,\mathrm{raw}}=300{,}000\cdot U
```

Reference implementation:

```rust
pub fn locked_phy_bonus_votes_raw(
	locked_amount_raw: u128,
	base_units_per_phy: u128,
) -> Option<u64> {
	let first_threshold =
		30_000u128.checked_mul(base_units_per_phy)?;

	let geometric_start =
		300_000u128.checked_mul(base_units_per_phy)?;

	const MULTIPLIER: u128 = 3;

	if locked_amount_raw < first_threshold {
		return Some(0);
	}

	if locked_amount_raw < geometric_start {
		return Some(1);
	}

	let mut bonus_votes: u64 = 2;
	let mut threshold = geometric_start;

	while threshold <= locked_amount_raw / MULTIPLIER {
		threshold = threshold.checked_mul(MULTIPLIER)?;
		bonus_votes = bonus_votes.checked_add(1)?;
	}

	Some(bonus_votes)
}
```

The PHY mint must be validated against the canonical PHY mint:

```text
EswgBj2hZKdgovX2ihWSUDnuBg9VNbGmSGoH5yjNsPRa
```

The mint decimal configuration must be validated or stored in the Governance Composer Registrar during initialization.

---

## Governance Composer Policy Configuration

The algorithm constants should be stored in a DAO-controlled Registrar rather than permanently hard-coded into instruction logic.

Suggested policy structure:

```rust
pub struct CommunityWeightPolicy {
	/// Base vote granted to an Active PRIVÉ governance identity.
	pub base_prive_weight: u64,

	/// Raw PHY units required for the first bonus vote.
	pub first_bonus_threshold: u64,

	/// Raw PHY units required for the second bonus vote and start of
	/// geometric threshold progression.
	pub geometric_start_threshold: u64,

	/// Multiplier applied to every later threshold.
	pub geometric_multiplier: u64,

	/// Minimum remaining lock duration required for governance eligibility.
	pub minimum_remaining_lock_seconds: u64,

	/// Number of Physis epochs a new lock must warm up before voting.
	pub warmup_epochs: u8,

	/// Active PRIVÉ membership is required.
	pub prive_required: bool,

	/// Persona verification may be required by future governance policy.
	pub persona_required: bool,

	/// Reserved for future policy changes.
	pub reserved: [u8; 128],
}
```

Initial values:

```text
base_prive_weight          = 1
first_bonus_threshold      = 30,000 PHY
geometric_start_threshold  = 300,000 PHY
geometric_multiplier       = 3
prive_required             = true
persona_required           = determined by rollout policy
```

Any policy update must require DAO governance authority.

---

## Required Invariants

The Governance Composer must enforce:

```text
1. No Active PRIVÉ membership means zero voting weight.

2. The PRIVÉ base vote is granted at most once per governance identity.

3. Only the canonical PHY mint may contribute to locked-PHY weight.

4. Liquid PHY balances do not contribute to voting weight.

5. Expired or withdrawable positions do not contribute unless explicitly
   permitted by DAO policy.

6. One underlying token amount cannot be counted through multiple sources.

7. One position cannot be counted for both a delegator and a delegate.

8. The calculated voter weight must be written only to the correct Realm,
   governing mint and governing token owner.

9. The VoterWeightRecord must expire according to the required Realms action
   and slot policy.

10. Policy constants may change only through DAO-authorized configuration.

11. Arithmetic must use checked integer operations.

12. No floating-point arithmetic may be used on-chain.
```

---

## Reference Test Vectors

### Locked-PHY Bonus Tests

```rust
#[cfg(test)]
mod bonus_tests {
	use super::*;

	#[test]
	fn calculates_locked_phy_bonus_votes() {
		assert_eq!(locked_phy_bonus_votes(0), 0);
		assert_eq!(locked_phy_bonus_votes(29_999), 0);

		assert_eq!(locked_phy_bonus_votes(30_000), 1);
		assert_eq!(locked_phy_bonus_votes(299_999), 1);

		assert_eq!(locked_phy_bonus_votes(300_000), 2);
		assert_eq!(locked_phy_bonus_votes(899_999), 2);

		assert_eq!(locked_phy_bonus_votes(900_000), 3);
		assert_eq!(locked_phy_bonus_votes(2_699_999), 3);

		assert_eq!(locked_phy_bonus_votes(2_700_000), 4);
		assert_eq!(locked_phy_bonus_votes(8_099_999), 4);

		assert_eq!(locked_phy_bonus_votes(8_100_000), 5);
		assert_eq!(locked_phy_bonus_votes(24_299_999), 5);

		assert_eq!(locked_phy_bonus_votes(24_300_000), 6);
		assert_eq!(locked_phy_bonus_votes(72_900_000), 7);
		assert_eq!(locked_phy_bonus_votes(218_700_000), 8);
		assert_eq!(locked_phy_bonus_votes(656_100_000), 9);
		assert_eq!(locked_phy_bonus_votes(1_968_300_000), 10);

		assert_eq!(locked_phy_bonus_votes(3_000_000_000), 10);
	}
}
```

### PRIVÉ Gate Tests

```rust
#[cfg(test)]
mod membership_tests {
	use super::*;

	#[test]
	fn rejects_governance_without_prive_membership() {
		assert_eq!(
			community_voter_weight(false, 0),
			0,
		);

		assert_eq!(
			community_voter_weight(false, 30_000),
			0,
		);

		assert_eq!(
			community_voter_weight(false, 300_000),
			0,
		);

		assert_eq!(
			community_voter_weight(false, 3_000_000_000),
			0,
		);
	}

	#[test]
	fn grants_base_vote_to_active_prive_member() {
		assert_eq!(
			community_voter_weight(true, 0),
			1,
		);

		assert_eq!(
			community_voter_weight(true, 29_999),
			1,
		);
	}

	#[test]
	fn adds_geometric_locked_phy_bonus() {
		assert_eq!(
			community_voter_weight(true, 30_000),
			2,
		);

		assert_eq!(
			community_voter_weight(true, 300_000),
			3,
		);

		assert_eq!(
			community_voter_weight(true, 900_000),
			4,
		);

		assert_eq!(
			community_voter_weight(true, 2_700_000),
			5,
		);

		assert_eq!(
			community_voter_weight(true, 8_100_000),
			6,
		);

		assert_eq!(
			community_voter_weight(true, 3_000_000_000),
			11,
		);
	}
}
```

### Boundary Tests

Every threshold must test:

```text
threshold - 1
threshold
threshold + 1
```

Example:

```rust
#[test]
fn tests_second_geometric_boundary() {
	assert_eq!(locked_phy_bonus_votes(899_999), 2);
	assert_eq!(locked_phy_bonus_votes(900_000), 3);
	assert_eq!(locked_phy_bonus_votes(900_001), 3);
}
```

---

## Example Participants

### PRIVÉ Member With No Locked PHY

```text
Active PRIVÉ:
Yes

Qualifying locked PHY:
0

Base vote:
1

PHY bonus:
0

Final community weight:
1
```

### Non-PRIVÉ Holder With 10 Million Locked PHY

```text
Active PRIVÉ:
No

Qualifying locked PHY:
10,000,000

Base vote:
0

PHY bonus considered:
No

Final community weight:
0

Lock rewards:
May remain eligible under the separate rewards policy.
```

### PRIVÉ Member With 350,000 Locked PHY

```text
Active PRIVÉ:
Yes

Qualifying locked PHY:
350,000

Base vote:
1

PHY bonus:
2

Final community weight:
3
```

### PRIVÉ Member With 8.1 Million Locked PHY

```text
Active PRIVÉ:
Yes

Qualifying locked PHY:
8,100,000

Base vote:
1

PHY bonus:
5

Final community weight:
6
```

### PRIVÉ Member With the Entire PHY Supply

```text
Active PRIVÉ:
Yes

Qualifying locked PHY:
3,000,000,000

Base vote:
1

PHY bonus:
10

Final community weight:
11
```

This is the theoretical mathematical maximum under the defined PHY supply cap.

---

## Non-Goals

This specification does not define:

```text
Council voting power
Council membership
Proposal thresholds
Community quorum
Council ratification requirements
Reward emission rates
Lock reward formulas
PRIVÉ NFT pricing
PRIVÉ admission policy
Persona verification procedure
VSR custody implementation
Streamflow contract migration
ASTRALIS governance
```

Those require separate governance and technical specifications.

---

## Summary

The Physis community voting algorithm is:

```math
\boxed{
V(P,L)=P\left(1+B(L)\right)
}
```

with:

```math
B(L)=
\begin{cases}
0,
& 0 \leq L < 30{,}000,\\[4pt]

1,
& 30{,}000 \leq L < 300{,}000,\\[4pt]

2+\left\lfloor
\log_{3}\left(\dfrac{L}{300{,}000}\right)
\right\rfloor,
& L \geq 300{,}000.
\end{cases}
```

The model provides:

```text
Controlled governance admission through PRIVÉ
One base community vote per admitted identity
Meaningful recognition of substantial locked-PHY commitment
Exponentially increasing cost for each additional vote
No linear whale voting
No arbitrary low cap
A natural finite maximum from the PHY supply
Rewards access for non-PRIVÉ lockers without governance access
```

The on-chain implementation must use checked integer threshold multiplication rather than floating-point logarithms.
