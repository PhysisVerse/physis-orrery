use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
pub struct EligibilityRegistry {
    pub version: u8,
    pub realm: Pubkey,
    pub authority: Pubkey,
    pub epoch_registry: Pubkey,
    pub governance_mode: u8,
    pub paused: bool,
    pub class_count: u32,
    pub record_count: u64,
    pub created_ts: i64,
    pub created_slot: u64,
    pub created_solana_epoch: u64,
    pub updated_ts: i64,
    pub updated_slot: u64,
    pub updated_solana_epoch: u64,
    pub bump: u8,
    pub reserved: [u8; RESERVED_BYTES],
}

impl EligibilityRegistry {
    pub const LEN: usize =
        1 + 32 + 32 + 32 + 1 + 1 + 4 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + RESERVED_BYTES;
}

#[account]
pub struct EligibilityClass {
    pub version: u8,
    pub registry: Pubkey,
    pub class_id: u32,
    pub name: [u8; NAME_BYTES],
    pub label: [u8; LABEL_BYTES],
    pub kind: u8,
    pub status: u8,
    pub enabled: bool,
    pub governance_eligible: bool,
    pub rewards_eligible: bool,
    pub gate_mint: Pubkey,
    pub min_amount: u64,
    pub valid_from_epoch_id: u32,
    pub valid_until_epoch_id: u32,
    pub created_ts: i64,
    pub created_slot: u64,
    pub created_solana_epoch: u64,
    pub updated_ts: i64,
    pub updated_slot: u64,
    pub updated_solana_epoch: u64,
    pub bump: u8,
    pub reserved: [u8; RESERVED_BYTES],
}

impl EligibilityClass {
    pub const LEN: usize = 1
        + 32
        + 4
        + NAME_BYTES
        + LABEL_BYTES
        + 1
        + 1
        + 1
        + 1
        + 1
        + 32
        + 8
        + 4
        + 4
        + 8
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1
        + RESERVED_BYTES;
}

#[account]
pub struct EligibilityRecord {
    pub version: u8,
    pub registry: Pubkey,
    pub eligibility_class: Pubkey,
    pub class_id: u32,
    pub subject_kind: u8,
    pub subject_key: [u8; SUBJECT_KEY_BYTES],
    pub wallet: Pubkey,
    pub status: u8,
    pub source: u8,
    pub issuer: Pubkey,
    pub metadata_hash: [u8; METADATA_HASH_BYTES],
    pub valid_from_epoch_id: u32,
    pub valid_until_epoch_id: u32,
    pub created_ts: i64,
    pub created_slot: u64,
    pub created_solana_epoch: u64,
    pub updated_ts: i64,
    pub updated_slot: u64,
    pub updated_solana_epoch: u64,
    pub bump: u8,
    pub reserved: [u8; RESERVED_BYTES],
}

impl EligibilityRecord {
    pub const LEN: usize = 1
        + 32
        + 32
        + 4
        + 1
        + SUBJECT_KEY_BYTES
        + 32
        + 1
        + 1
        + 32
        + METADATA_HASH_BYTES
        + 4
        + 4
        + 8
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1
        + RESERVED_BYTES;
}
