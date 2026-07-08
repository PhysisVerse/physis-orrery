use anchor_lang::prelude::*;

pub struct Checkpoint {
    pub ts: i64,
    pub slot: u64,
    pub solana_epoch: u64,
}

pub fn current_checkpoint() -> Result<Checkpoint> {
    let clock = Clock::get()?;
    Ok(Checkpoint {
        ts: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    })
}
