use anchor_lang::prelude::*;

pub const REGISTRY_VERSION: u8 = 1;
pub const ELIGIBILITY_CLASS_VERSION: u8 = 1;
pub const ELIGIBILITY_RECORD_VERSION: u8 = 1;

pub const NAME_BYTES: usize = 32;
pub const LABEL_BYTES: usize = 16;
pub const SUBJECT_KEY_BYTES: usize = 32;
pub const METADATA_HASH_BYTES: usize = 32;
pub const RESERVED_BYTES: usize = 128;

pub const SEED_PREFIX: &[u8] = b"physis";
pub const SEED_ELIGIBILITY_REGISTRY: &[u8] = b"eligibility-registry";
pub const SEED_ELIGIBILITY_CLASS: &[u8] = b"eligibility-class";
pub const SEED_ELIGIBILITY_RECORD: &[u8] = b"eligibility-record";

pub const GOVERNANCE_MODE_PRIVE_ONLY: u8 = 1;

pub const CLASS_ID_PRIVE_MEMBER: u32 = 1;
pub const CLASS_ID_PERSONA_VERIFIED: u32 = 2;

pub const CLASS_ID_PHY_HOLDER_RESERVED: u32 = 10;
pub const CLASS_ID_ASTRALIS_HOLDER_RESERVED: u32 = 11;
pub const CLASS_ID_LOCKED_PHY_ELIGIBLE_RESERVED: u32 = 13;
pub const CLASS_ID_FOUNDRY_CONTRIBUTOR_RESERVED: u32 = 20;
pub const CLASS_ID_ASTRALIS_OPERATOR_PRECHECK_RESERVED: u32 = 40;

pub const SUBJECT_KIND_WALLET: u8 = 1;
pub const SUBJECT_KIND_PERSONA_HASH: u8 = 2;
pub const SUBJECT_KIND_EXTERNAL_ATTESTATION: u8 = 3;

pub const CLASS_KIND_PRIVE_MEMBER: u8 = 1;
pub const CLASS_KIND_PERSONA_VERIFIED: u8 = 2;

pub const CLASS_STATUS_DRAFT: u8 = 0;
pub const CLASS_STATUS_ACTIVE: u8 = 1;
pub const CLASS_STATUS_DISABLED: u8 = 2;
pub const CLASS_STATUS_DEPRECATED: u8 = 3;

pub const RECORD_STATUS_PENDING: u8 = 0;
pub const RECORD_STATUS_ACTIVE: u8 = 1;
pub const RECORD_STATUS_SUSPENDED: u8 = 2;
pub const RECORD_STATUS_REVOKED: u8 = 3;
pub const RECORD_STATUS_EXPIRED: u8 = 4;

pub const ELIGIBILITY_SOURCE_UNKNOWN: u8 = 0;
pub const ELIGIBILITY_SOURCE_DAO_APPROVED: u8 = 1;
pub const ELIGIBILITY_SOURCE_PRIVE_LEGACY: u8 = 2;
pub const ELIGIBILITY_SOURCE_PERSONA_ATTESTATION: u8 = 3;
pub const ELIGIBILITY_SOURCE_MANUAL_COUNCIL: u8 = 4;

pub fn validate_authority(expected: Pubkey, actual: Pubkey) -> Result<()> {
    require_keys_eq!(
        expected,
        actual,
        crate::errors::EligibilityError::InvalidAuthority
    );
    Ok(())
}
