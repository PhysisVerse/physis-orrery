use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::IssuerGrantDisabled;
use crate::state::{EligibilityClass, EligibilityRegistry, IssuerGrant};

#[derive(Accounts)]
#[instruction(class_id: u32, issuer: Pubkey)]
pub struct DisableIssuerGrant<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = !registry.paused
            @ EligibilityError::RegistryPaused,
        constraint = registry.authority == authority.key()
            @ EligibilityError::InvalidAuthority
    )]
    pub registry: Account<'info, EligibilityRegistry>,

    #[account(
        constraint = eligibility_class.registry == registry.key()
            @ EligibilityError::ClassRegistryMismatch,
        constraint = eligibility_class.class_id == class_id
            @ EligibilityError::InvalidClassId
    )]
    pub eligibility_class: Account<'info, EligibilityClass>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            SEED_ISSUER_GRANT,
            registry.key().as_ref(),
            class_id.to_le_bytes().as_ref(),
            issuer.as_ref()
        ],
        bump = issuer_grant.bump
    )]
    pub issuer_grant: Account<'info, IssuerGrant>,
}

pub fn process_disable_issuer_grant(
    ctx: Context<DisableIssuerGrant>,
    class_id: u32,
    issuer: Pubkey,
) -> Result<()> {
    let clock = Clock::get()?;
    let registry_key = ctx.accounts.registry.key();
    let eligibility_class_key = ctx.accounts.eligibility_class.key();
    let issuer_grant_key = ctx.accounts.issuer_grant.key();

    let registry = &mut ctx.accounts.registry;
    let issuer_grant = &mut ctx.accounts.issuer_grant;

    require!(
        issuer_grant.version == ISSUER_GRANT_VERSION,
        EligibilityError::InvalidIssuerGrantVersion
    );

    require_keys_eq!(
        issuer_grant.registry,
        registry_key,
        EligibilityError::IssuerGrantRegistryMismatch
    );

    require_keys_eq!(
        issuer_grant.eligibility_class,
        eligibility_class_key,
        EligibilityError::IssuerGrantClassMismatch
    );

    require!(
        issuer_grant.class_id == class_id,
        EligibilityError::InvalidClassId
    );

    require_keys_eq!(
        issuer_grant.issuer,
        issuer,
        EligibilityError::IssuerGrantIssuerMismatch
    );

    require!(
        issuer_grant.enabled,
        EligibilityError::IssuerGrantAlreadyDisabled
    );

    issuer_grant.enabled = false;
    issuer_grant.updated_ts = clock.unix_timestamp;
    issuer_grant.updated_slot = clock.slot;
    issuer_grant.updated_solana_epoch = clock.epoch;

    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(IssuerGrantDisabled {
        registry: registry_key,
        eligibility_class: eligibility_class_key,
        issuer_grant: issuer_grant_key,
        authority: ctx.accounts.authority.key(),
        class_id,
        issuer,
        allowed_source: issuer_grant.allowed_source,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
