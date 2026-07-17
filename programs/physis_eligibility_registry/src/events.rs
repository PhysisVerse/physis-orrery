use anchor_lang::prelude::*;

#[event]
pub struct EligibilityRegistryInitialized {
    pub registry: Pubkey,
    pub realm: Pubkey,
    pub authority: Pubkey,
    pub epoch_registry: Pubkey,
    pub governance_mode: u8,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct EligibilityClassUpserted {
    pub registry: Pubkey,
    pub eligibility_class: Pubkey,
    pub class_id: u32,
    pub kind: u8,
    pub status: u8,
    pub enabled: bool,
    pub governance_eligible: bool,
    pub rewards_eligible: bool,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct EligibilityClassDisabled {
    pub registry: Pubkey,
    pub eligibility_class: Pubkey,
    pub class_id: u32,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct IssuerGrantUpserted {
    pub registry: Pubkey,
    pub eligibility_class: Pubkey,
    pub issuer_grant: Pubkey,
    pub authority: Pubkey,
    pub class_id: u32,
    pub issuer: Pubkey,
    pub allowed_source: u8,
    pub permissions: u16,
    pub enabled: bool,
    pub max_evidence_ttl_seconds: u32,
    pub valid_from_ts: i64,
    pub valid_until_ts: i64,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct IssuerGrantDisabled {
    pub registry: Pubkey,
    pub eligibility_class: Pubkey,
    pub issuer_grant: Pubkey,
    pub authority: Pubkey,
    pub class_id: u32,
    pub issuer: Pubkey,
    pub allowed_source: u8,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct EligibilityRecordUpserted {
    pub registry: Pubkey,
    pub eligibility_class: Pubkey,
    pub eligibility_record: Pubkey,
    pub class_id: u32,
    pub subject_kind: u8,
    pub subject_key: [u8; 32],
    pub wallet: Pubkey,
    pub status: u8,
    pub source: u8,
    pub issuer: Pubkey,
    pub auth_kind: u8,
    pub metadata_hash: [u8; 32],
    pub evidence_issued_at: i64,
    pub evidence_expires_at: i64,
    pub valid_from_epoch_id: u32,
    pub valid_until_epoch_id: u32,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct EligibilityRecordSuspended {
    pub registry: Pubkey,
    pub eligibility_class: Pubkey,
    pub eligibility_record: Pubkey,
    pub class_id: u32,
    pub subject_kind: u8,
    pub subject_key: [u8; 32],
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct EligibilityRecordRevoked {
    pub registry: Pubkey,
    pub eligibility_class: Pubkey,
    pub eligibility_record: Pubkey,
    pub class_id: u32,
    pub subject_kind: u8,
    pub subject_key: [u8; 32],
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct EligibilityRegistryPaused {
    pub registry: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct EligibilityRegistryResumed {
    pub registry: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

#[event]
pub struct EligibilityRegistryAuthorityTransferred {
    pub registry: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}
