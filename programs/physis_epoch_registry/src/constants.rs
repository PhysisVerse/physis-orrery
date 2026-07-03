use anchor_lang::prelude::*;

pub const REGISTRY_VERSION: u8 = 1;
pub const EPOCH_VERSION: u8 = 1;

pub const PHYSIS_YEAR_START_MONTH: u8 = 4;
pub const PHYSIS_YEAR_START_DAY: u8 = 1;

pub const ASTRALIS_EPOCH_ZERO_TS: i64 = 1_725_148_800; // 2024-09-01T00:00:00Z
pub const ASTRALIS_EPOCH_DURATION_SECONDS: i64 = 21_600; // 6 hours

pub const LABEL_BYTES: usize = 16;
pub const RESERVED_BYTES: usize = 64;

pub const EPOCH_STATUS_PENDING: u8 = 0;
pub const EPOCH_STATUS_ACTIVE: u8 = 1;
pub const EPOCH_STATUS_CLOSED: u8 = 2;
pub const EPOCH_STATUS_CANCELLED: u8 = 3;

pub const SEED_PREFIX: &[u8] = b"physis";
pub const SEED_EPOCH_REGISTRY: &[u8] = b"epoch-registry";
pub const SEED_EPOCH: &[u8] = b"epoch";

pub const EMPTY_PUBKEY_OPTION_SIZE: usize = 1 + 32;

pub fn validate_authority(expected: Pubkey, actual: Pubkey) -> Result<()> {
    require_keys_eq!(
        expected,
        actual,
        crate::errors::OrreryError::InvalidAuthority
    );
    Ok(())
}
