use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::EligibilityClassDisabled;
use crate::state::{EligibilityClass, EligibilityRegistry};

#[derive(Accounts)]
#[instruction(class_id: u32)]
pub struct DisableEligibilityClass<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = !registry.paused @ EligibilityError::RegistryPaused,
        constraint = registry.authority == authority.key() @ EligibilityError::InvalidAuthority
    )]
    pub registry: Account<'info, EligibilityRegistry>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            SEED_ELIGIBILITY_CLASS,
            registry.key().as_ref(),
            class_id.to_le_bytes().as_ref()
        ],
        bump = eligibility_class.bump,
        constraint = eligibility_class.registry == registry.key() @ EligibilityError::ClassRegistryMismatch,
        constraint = eligibility_class.class_id == class_id @ EligibilityError::InvalidClassId
    )]
    pub eligibility_class: Account<'info, EligibilityClass>,
}

pub fn process_disable_eligibility_class(
    ctx: Context<DisableEligibilityClass>,
    class_id: u32,
) -> Result<()> {
    require!(class_id != 0, EligibilityError::InvalidClassId);

    let clock = Clock::get()?;

    let registry_key = ctx.accounts.registry.key();
    let eligibility_class_key = ctx.accounts.eligibility_class.key();

    let registry = &mut ctx.accounts.registry;
    let eligibility_class = &mut ctx.accounts.eligibility_class;

    eligibility_class.status = CLASS_STATUS_DISABLED;
    eligibility_class.enabled = false;

    eligibility_class.updated_ts = clock.unix_timestamp;
    eligibility_class.updated_slot = clock.slot;
    eligibility_class.updated_solana_epoch = clock.epoch;

    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(EligibilityClassDisabled {
        registry: registry_key,
        eligibility_class: eligibility_class_key,
        class_id,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
