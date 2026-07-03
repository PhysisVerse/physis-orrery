use anchor_lang::prelude::*;

#[event]
pub struct RegistryInitialized {
    pub registry: Pubkey,
    pub realm: Pubkey,
    pub authority: Pubkey,
    pub astralis_epoch_zero_ts: i64,
    pub astralis_epoch_duration_seconds: i64,
}

#[event]
pub struct EpochRegistered {
    pub registry: Pubkey,
    pub epoch: Pubkey,
    pub epoch_id: u32,
    pub physis_year: u16,
    pub physis_quarter: u8,
    pub start_ts: i64,
    pub end_ts: i64,
}

#[event]
pub struct EpochActivated {
    pub registry: Pubkey,
    pub epoch: Pubkey,
    pub epoch_id: u32,
    pub activated_at_ts: i64,
    pub activated_at_slot: u64,
    pub activated_at_solana_epoch: u64,
}

#[event]
pub struct EpochClosed {
    pub registry: Pubkey,
    pub epoch: Pubkey,
    pub epoch_id: u32,
    pub closed_at_ts: i64,
    pub closed_at_slot: u64,
    pub closed_at_solana_epoch: u64,
}

#[event]
pub struct RegistryPaused {
    pub registry: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct RegistryResumed {
    pub registry: Pubkey,
    pub authority: Pubkey,
}
