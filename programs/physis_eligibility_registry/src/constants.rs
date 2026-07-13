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
pub const SEED_EPOCH_REGISTRY: &[u8] = b"epoch-registry";
pub const SEED_ELIGIBILITY_REGISTRY: &[u8] = b"eligibility-registry";
pub const SEED_ELIGIBILITY_CLASS: &[u8] = b"eligibility-class";
pub const SEED_ELIGIBILITY_RECORD: &[u8] = b"eligibility-record";

pub const PHYSIS_EPOCH_REGISTRY_PROGRAM_ID: Pubkey =
    pubkey!("PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE");

pub const GOVERNANCE_MODE_PRIVE_ONLY: u8 = 1;

pub const CLASS_ID_PRIVE_MEMBER: u32 = 1;
pub const CLASS_ID_PERSONA_VERIFIED: u32 = 2;

// Reserved future class identifiers.
// These are documented but cannot become live Program 2 v1 classes.
pub const CLASS_ID_PHY_HOLDER_RESERVED: u32 = 10;
pub const CLASS_ID_ASTRALIS_HOLDER_RESERVED: u32 = 11;
pub const CLASS_ID_LOCKED_PHY_ELIGIBLE_RESERVED: u32 = 13;
pub const CLASS_ID_FOUNDRY_CONTRIBUTOR_RESERVED: u32 = 20;
pub const CLASS_ID_ASTRALIS_OPERATOR_PRECHECK_RESERVED: u32 = 40;

pub const SUBJECT_KIND_WALLET: u8 = 1;

// Reserved future subject kinds.
// Program 2 v1 records remain wallet-addressed.
pub const SUBJECT_KIND_PERSONA_HASH: u8 = 2;
pub const SUBJECT_KIND_EXTERNAL_ATTESTATION: u8 = 3;

pub const CLASS_KIND_PRIVE_MEMBER: u8 = 1;
pub const CLASS_KIND_PERSONA_VERIFIED: u8 = 2;

// Reserved future class kinds.
// These remain invalid for live Program 2 v1 classes.
pub const CLASS_KIND_PHY_HOLDER_RESERVED: u8 = 10;
pub const CLASS_KIND_ASTRALIS_HOLDER_RESERVED: u8 = 11;
pub const CLASS_KIND_LOCKED_PHY_ELIGIBLE_RESERVED: u8 = 13;
pub const CLASS_KIND_FOUNDRY_CONTRIBUTOR_RESERVED: u8 = 20;
pub const CLASS_KIND_ASTRALIS_OPERATOR_PRECHECK_RESERVED: u8 = 40;

pub const CLASS_STATUS_DRAFT: u8 = 0;
pub const CLASS_STATUS_ACTIVE: u8 = 1;
pub const CLASS_STATUS_DISABLED: u8 = 2;
pub const CLASS_STATUS_DEPRECATED: u8 = 3;

pub const RECORD_STATUS_PENDING: u8 = 0;
pub const RECORD_STATUS_ACTIVE: u8 = 1;
pub const RECORD_STATUS_SUSPENDED: u8 = 2;
pub const RECORD_STATUS_REVOKED: u8 = 3;
pub const RECORD_STATUS_EXPIRED: u8 = 4;

// Reserved sentinel. This value cannot be written to a live v1 record.
pub const ELIGIBILITY_SOURCE_UNKNOWN: u8 = 0;

pub const ELIGIBILITY_SOURCE_DAO_APPROVED: u8 = 1;
pub const ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED: u8 = 2;
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

pub fn is_valid_class_kind(kind: u8) -> bool {
    matches!(kind, CLASS_KIND_PRIVE_MEMBER | CLASS_KIND_PERSONA_VERIFIED)
}

pub fn is_valid_class_identity(class_id: u32, kind: u8) -> bool {
    matches!(
        (class_id, kind),
        (CLASS_ID_PRIVE_MEMBER, CLASS_KIND_PRIVE_MEMBER)
            | (CLASS_ID_PERSONA_VERIFIED, CLASS_KIND_PERSONA_VERIFIED)
    )
}

pub fn is_valid_class_status(status: u8) -> bool {
    matches!(
        status,
        CLASS_STATUS_DRAFT | CLASS_STATUS_ACTIVE | CLASS_STATUS_DISABLED | CLASS_STATUS_DEPRECATED
    )
}

pub fn is_valid_class_state(status: u8, enabled: bool) -> bool {
    matches!(
        (status, enabled),
        (CLASS_STATUS_ACTIVE, true)
            | (CLASS_STATUS_DRAFT, false)
            | (CLASS_STATUS_DISABLED, false)
            | (CLASS_STATUS_DEPRECATED, false)
    )
}

// Direct upsert is limited to constructive states.
// Suspension and revocation must use their dedicated instructions.
pub fn is_valid_record_upsert_status(status: u8) -> bool {
    matches!(status, RECORD_STATUS_PENDING | RECORD_STATUS_ACTIVE)
}

pub fn is_valid_eligibility_source(source: u8) -> bool {
    matches!(
        source,
        ELIGIBILITY_SOURCE_DAO_APPROVED
            | ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED
            | ELIGIBILITY_SOURCE_PERSONA_ATTESTATION
            | ELIGIBILITY_SOURCE_MANUAL_COUNCIL
    )
}

pub fn is_valid_class_source(class_id: u32, class_kind: u8, source: u8) -> bool {
    matches!(
        (class_id, class_kind, source),
        (
            CLASS_ID_PRIVE_MEMBER,
            CLASS_KIND_PRIVE_MEMBER,
            ELIGIBILITY_SOURCE_DAO_APPROVED
                | ELIGIBILITY_SOURCE_PRIVE_COLLECTION_VERIFIED
                | ELIGIBILITY_SOURCE_MANUAL_COUNCIL
        ) | (
            CLASS_ID_PERSONA_VERIFIED,
            CLASS_KIND_PERSONA_VERIFIED,
            ELIGIBILITY_SOURCE_PERSONA_ATTESTATION
        )
    )
}

pub fn is_valid_epoch_window(valid_from_epoch_id: u32, valid_until_epoch_id: u32) -> bool {
    valid_until_epoch_id == 0 || valid_until_epoch_id >= valid_from_epoch_id
}
