use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::OrreryError;
use crate::events::EpochClosed;
use crate::state::{EpochRegistry, PhysisEpoch};

#[derive(Accounts)]
pub struct CloseEpoch<'info> {
    pub authority: Signer<'info>,

    #[account(
		mut,
		seeds = [
			SEED_PREFIX,
			SEED_EPOCH_REGISTRY,
			registry.realm.as_ref()
		],
		bump = registry.bump
	)]
    pub registry: Account<'info, EpochRegistry>,

    #[account(
		mut,
		seeds = [
			SEED_PREFIX,
			SEED_EPOCH,
			registry.key().as_ref(),
			&epoch.epoch_id.to_le_bytes()
		],
		bump = epoch.bump
	)]
    pub epoch: Account<'info, PhysisEpoch>,
}

pub fn process_close_epoch(ctx: Context<CloseEpoch>) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    let epoch = &mut ctx.accounts.epoch;

    validate_authority(registry.authority, ctx.accounts.authority.key())?;

    require!(!registry.paused, OrreryError::RegistryPaused);
    require!(
        epoch.status == EPOCH_STATUS_ACTIVE,
        OrreryError::EpochNotActive
    );
    require!(
        registry.current_epoch == Some(epoch.key()),
        OrreryError::EpochIsNotCurrent
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= epoch.end_ts,
        OrreryError::EpochHasNotEnded
    );

    epoch.status = EPOCH_STATUS_CLOSED;
    epoch.closed_at_ts = clock.unix_timestamp;
    epoch.closed_at_slot = clock.slot;
    epoch.closed_at_solana_epoch = clock.epoch;

    registry.current_epoch = None;
    registry.latest_closed_epoch = Some(epoch.key());

    emit!(EpochClosed {
        registry: registry.key(),
        epoch: epoch.key(),
        epoch_id: epoch.epoch_id,
        closed_at_ts: clock.unix_timestamp,
        closed_at_slot: clock.slot,
        closed_at_solana_epoch: clock.epoch,
    });

    Ok(())
}
