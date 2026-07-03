use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::OrreryError;
use crate::events::RegistryInitialized;
use crate::state::EpochRegistry;

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    /// CHECK: Realm account is stored as an external Realms/SPL Governance reference.
    pub realm: UncheckedAccount<'info>,

    #[account(
		init,
		payer = payer,
		space = 8 + EpochRegistry::LEN,
		seeds = [
			SEED_PREFIX,
			SEED_EPOCH_REGISTRY,
			realm.key().as_ref()
		],
		bump
	)]
    pub registry: Account<'info, EpochRegistry>,

    pub system_program: Program<'info, System>,
}

pub fn process_initialize_registry(
    ctx: Context<InitializeRegistry>,
    physis_year_start_month: u8,
    physis_year_start_day: u8,
    astralis_epoch_zero_ts: i64,
    astralis_epoch_duration_seconds: i64,
) -> Result<()> {
    require!(
        physis_year_start_month == PHYSIS_YEAR_START_MONTH
            && physis_year_start_day == PHYSIS_YEAR_START_DAY,
        OrreryError::InvalidPhysisYearStart
    );

    require!(
        astralis_epoch_duration_seconds == ASTRALIS_EPOCH_DURATION_SECONDS
            && astralis_epoch_zero_ts == ASTRALIS_EPOCH_ZERO_TS,
        OrreryError::InvalidAstralisEpochConfig
    );

    let registry = &mut ctx.accounts.registry;

    registry.version = REGISTRY_VERSION;
    registry.authority = ctx.accounts.authority.key();
    registry.realm = ctx.accounts.realm.key();
    registry.physis_year_start_month = physis_year_start_month;
    registry.physis_year_start_day = physis_year_start_day;
    registry.astralis_epoch_zero_ts = astralis_epoch_zero_ts;
    registry.astralis_epoch_duration_seconds = astralis_epoch_duration_seconds;
    registry.current_epoch = None;
    registry.latest_closed_epoch = None;
    registry.paused = false;
    registry.bump = ctx.bumps.registry;
    registry.reserved = [0u8; RESERVED_BYTES];

    emit!(RegistryInitialized {
        registry: registry.key(),
        realm: registry.realm,
        authority: registry.authority,
        astralis_epoch_zero_ts,
        astralis_epoch_duration_seconds,
    });

    Ok(())
}
