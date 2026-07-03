use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::OrreryError;
use crate::events::EpochActivated;
use crate::state::{EpochRegistry, PhysisEpoch};

#[derive(Accounts)]
pub struct ActivateEpoch<'info> {
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

pub fn process_activate_epoch(ctx: Context<ActivateEpoch>) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    let epoch = &mut ctx.accounts.epoch;

    validate_authority(registry.authority, ctx.accounts.authority.key())?;

    require!(!registry.paused, OrreryError::RegistryPaused);
    require!(
        registry.current_epoch.is_none(),
        OrreryError::ActiveEpochAlreadySet
    );
    require!(
        epoch.status == EPOCH_STATUS_PENDING,
        OrreryError::EpochNotPending
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= epoch.start_ts,
        OrreryError::EpochHasNotStarted
    );

    epoch.status = EPOCH_STATUS_ACTIVE;
    epoch.activated_at_ts = clock.unix_timestamp;
    epoch.activated_at_slot = clock.slot;
    epoch.activated_at_solana_epoch = clock.epoch;

    registry.current_epoch = Some(epoch.key());

    emit!(EpochActivated {
        registry: registry.key(),
        epoch: epoch.key(),
        epoch_id: epoch.epoch_id,
        activated_at_ts: clock.unix_timestamp,
        activated_at_slot: clock.slot,
        activated_at_solana_epoch: clock.epoch,
    });

    Ok(())
}
