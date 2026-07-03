use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::OrreryError;
use crate::events::EpochRegistered;
use crate::state::{EpochRegistry, PhysisEpoch};
use crate::utils::time::expected_epoch_id;

#[derive(Accounts)]
#[instruction(epoch_id: u32)]
pub struct RegisterEpoch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

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
		init,
		payer = payer,
		space = 8 + PhysisEpoch::LEN,
		seeds = [
			SEED_PREFIX,
			SEED_EPOCH,
			registry.key().as_ref(),
			&epoch_id.to_le_bytes()
		],
		bump
	)]
    pub epoch: Account<'info, PhysisEpoch>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn process_register_epoch(
    ctx: Context<RegisterEpoch>,
    epoch_id: u32,
    calendar_year: u16,
    calendar_quarter: u8,
    physis_year: u16,
    physis_quarter: u8,
    label: [u8; LABEL_BYTES],
    start_ts: i64,
    end_ts: i64,
) -> Result<()> {
    let registry = &ctx.accounts.registry;

    validate_authority(registry.authority, ctx.accounts.authority.key())?;

    require!(!registry.paused, OrreryError::RegistryPaused);
    require!(
        (1..=4).contains(&calendar_quarter),
        OrreryError::InvalidCalendarQuarter
    );
    require!(
        (1..=4).contains(&physis_quarter),
        OrreryError::InvalidPhysisQuarter
    );
    require!(end_ts > start_ts, OrreryError::InvalidEpochTimestamps);

    let expected_id = expected_epoch_id(physis_year, physis_quarter)?;
    require!(epoch_id == expected_id, OrreryError::InvalidEpochId);

    let clock = Clock::get()?;
    let epoch = &mut ctx.accounts.epoch;

    epoch.version = EPOCH_VERSION;
    epoch.registry = registry.key();
    epoch.epoch_id = epoch_id;
    epoch.calendar_year = calendar_year;
    epoch.calendar_quarter = calendar_quarter;
    epoch.physis_year = physis_year;
    epoch.physis_quarter = physis_quarter;
    epoch.label = label;
    epoch.start_ts = start_ts;
    epoch.end_ts = end_ts;
    epoch.status = EPOCH_STATUS_PENDING;

    epoch.registered_at_ts = clock.unix_timestamp;
    epoch.registered_at_slot = clock.slot;
    epoch.registered_at_solana_epoch = clock.epoch;

    epoch.activated_at_ts = 0;
    epoch.activated_at_slot = 0;
    epoch.activated_at_solana_epoch = 0;

    epoch.closed_at_ts = 0;
    epoch.closed_at_slot = 0;
    epoch.closed_at_solana_epoch = 0;

    epoch.bump = ctx.bumps.epoch;
    epoch.reserved = [0u8; RESERVED_BYTES];

    emit!(EpochRegistered {
        registry: registry.key(),
        epoch: epoch.key(),
        epoch_id,
        physis_year,
        physis_quarter,
        start_ts,
        end_ts,
    });

    Ok(())
}
