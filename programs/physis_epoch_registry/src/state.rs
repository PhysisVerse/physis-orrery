use anchor_lang::prelude::*;

use crate::constants::{LABEL_BYTES, RESERVED_BYTES};

#[account]
pub struct EpochRegistry {
    pub version: u8,
    pub authority: Pubkey,
    pub realm: Pubkey,

    pub physis_year_start_month: u8,
    pub physis_year_start_day: u8,

    pub astralis_epoch_zero_ts: i64,
    pub astralis_epoch_duration_seconds: i64,

    pub current_epoch: Option<Pubkey>,
    pub latest_closed_epoch: Option<Pubkey>,

    pub paused: bool,
    pub bump: u8,

    pub reserved: [u8; RESERVED_BYTES],
}

impl EpochRegistry {
    pub const LEN: usize = 1 +     // version
		32 +    // authority
		32 +    // realm
		1 +     // physis_year_start_month
		1 +     // physis_year_start_day
		8 +     // astralis_epoch_zero_ts
		8 +     // astralis_epoch_duration_seconds
		(1 + 32) + // current_epoch Option<Pubkey>
		(1 + 32) + // latest_closed_epoch Option<Pubkey>
		1 +     // paused
		1 +     // bump
		RESERVED_BYTES;
}

#[account]
pub struct PhysisEpoch {
    pub version: u8,
    pub registry: Pubkey,

    pub epoch_id: u32,

    pub calendar_year: u16,
    pub calendar_quarter: u8,

    pub physis_year: u16,
    pub physis_quarter: u8,

    pub label: [u8; LABEL_BYTES],

    pub start_ts: i64,
    pub end_ts: i64,

    pub status: u8,

    pub registered_at_ts: i64,
    pub registered_at_slot: u64,
    pub registered_at_solana_epoch: u64,

    pub activated_at_ts: i64,
    pub activated_at_slot: u64,
    pub activated_at_solana_epoch: u64,

    pub closed_at_ts: i64,
    pub closed_at_slot: u64,
    pub closed_at_solana_epoch: u64,

    pub bump: u8,

    pub reserved: [u8; RESERVED_BYTES],
}

impl PhysisEpoch {
    pub const LEN: usize = 1 +     // version
		32 +    // registry
		4 +     // epoch_id
		2 +     // calendar_year
		1 +     // calendar_quarter
		2 +     // physis_year
		1 +     // physis_quarter
		LABEL_BYTES +
		8 +     // start_ts
		8 +     // end_ts
		1 +     // status
		8 +     // registered_at_ts
		8 +     // registered_at_slot
		8 +     // registered_at_solana_epoch
		8 +     // activated_at_ts
		8 +     // activated_at_slot
		8 +     // activated_at_solana_epoch
		8 +     // closed_at_ts
		8 +     // closed_at_slot
		8 +     // closed_at_solana_epoch
		1 +     // bump
		RESERVED_BYTES;
}
