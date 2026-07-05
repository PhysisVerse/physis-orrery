# Security Policy

## Reporting a Vulnerability

Please report security issues affecting Physis Orrery to:

```text
care@phys.is
```

Include as much detail as possible, including:

* affected program ID
* affected instruction or account type
* affected account address, if relevant
* reproduction steps
* transaction signatures, if applicable
* potential impact
* suggested mitigation, if known

## Covered Programs

This policy currently covers the Orrery on-chain program suite, beginning with the Physis Epoch Registry.

### Physis Epoch Registry

```text
Program Name:
physis_epoch_registry

Program ID:
PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE

Repository:
https://github.com/PhysisVerse/physis-orrery
```

## Scope

In scope:

* vulnerabilities in Orrery on-chain programs
* vulnerabilities affecting program authority, account validation, PDA derivation, or instruction execution
* vulnerabilities affecting Physis epoch registry state
* vulnerabilities affecting upgrade authority, registry authority, or governance-controlled execution
* vulnerabilities affecting future Orrery programs once added to this repository

Out of scope:

* phishing or social engineering
* spam
* issues requiring compromised private keys
* issues in unrelated third-party programs
* non-security bugs without material impact

## Disclosure Guidelines

Please do not publicly disclose a vulnerability before the Physis team has had time to review and respond.

Please do not exploit vulnerabilities against live users, DAO treasury accounts, or production program state.

Please avoid privacy violations, data destruction, service disruption, or unauthorized access while investigating.

## Response

The Physis team will review reports and coordinate fixes through the appropriate DAO/governance process when required.

For issues affecting DAO-owned programs, remediation may require Realms governance review, Council approval, or a DAO-executed upgrade proposal.

## Preferred Language

```text
English
```

## Acknowledgements

Valid security reports may be acknowledged through GitHub Security Advisories or another appropriate Physis disclosure channel.
