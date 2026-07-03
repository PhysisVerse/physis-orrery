# Physis Epoch Registry

The Physis Epoch Registry is the canonical on-chain time registry for Orrery.

It defines Physis quarterly epochs, preserves the ASTRALIS 6-hour service epoch anchor, and provides a neutral clock primitive for future Physis programs.

## Authority

The registry is intended to be controlled by the Physis DAO through the Main/Council Realms-governed authority.

No individual founder/admin wallet should control production registry authority.

## Time Model

Canonical on-chain time uses Unix seconds from Solana `Clock.unix_timestamp`.

Solana slot and Solana epoch are stored as audit/checkpoint metadata.

## Physis Calendar

Physis year starts April 1.

- Physis Q1: Apr-Jun
- Physis Q2: Jul-Sep
- Physis Q3: Oct-Dec
- Physis Q4: Jan-Mar

## ASTRALIS Service Epoch

ASTRALIS service epochs are 6-hour operational epochs.

- Epoch zero: 2024-09-01T00:00:00Z
- Unix timestamp: 1725148800
- Duration: 21600 seconds

ASTRALIS leader rotation and node activity are not implemented in this program. Future ASTRALIS programs may reference this registry.
