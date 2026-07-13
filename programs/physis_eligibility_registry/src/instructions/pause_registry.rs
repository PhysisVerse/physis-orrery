use anchor_lang::prelude::*;

use crate::errors::EligibilityError;
use crate::events::EligibilityRegistryPaused;
use crate::state::EligibilityRegistry;

#[derive(Accounts)]
pub struct PauseRegistry<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = registry.authority == authority.key()
            @ EligibilityError::InvalidAuthority,
        constraint = !registry.paused
            @ EligibilityError::RegistryPaused
    )]
    pub registry: Account<'info, EligibilityRegistry>,
}

pub fn process_pause_registry(ctx: Context<PauseRegistry>) -> Result<()> {
    let clock = Clock::get()?;
    let registry_key = ctx.accounts.registry.key();
    let authority_key = ctx.accounts.authority.key();

    let registry = &mut ctx.accounts.registry;

    registry.paused = true;
    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(EligibilityRegistryPaused {
        registry: registry_key,
        authority: authority_key,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
