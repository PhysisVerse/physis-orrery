use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::IssuerGrantUpserted;
use crate::state::{EligibilityClass, EligibilityRegistry, IssuerGrant};

#[derive(Accounts)]
#[instruction(class_id: u32, issuer: Pubkey)]
pub struct UpsertIssuerGrant<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

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
            @ EligibilityError::InvalidClassId,
        constraint = eligibility_class.enabled
            && eligibility_class.status == CLASS_STATUS_ACTIVE
            @ EligibilityError::EligibilityClassDisabled
    )]
    pub eligibility_class: Account<'info, EligibilityClass>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + IssuerGrant::LEN,
        seeds = [
            SEED_PREFIX,
            SEED_ISSUER_GRANT,
            registry.key().as_ref(),
            class_id.to_le_bytes().as_ref(),
            issuer.as_ref()
        ],
        bump
    )]
    pub issuer_grant: Account<'info, IssuerGrant>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn process_upsert_issuer_grant(
    ctx: Context<UpsertIssuerGrant>,
    class_id: u32,
    issuer: Pubkey,
    allowed_source: u8,
    permissions: u16,
    max_evidence_ttl_seconds: u32,
    valid_from_ts: i64,
    valid_until_ts: i64,
) -> Result<()> {
    require!(class_id != 0, EligibilityError::InvalidClassId);

    require!(issuer != Pubkey::default(), EligibilityError::InvalidIssuer);

    require!(
        is_delegated_issuer_source(allowed_source),
        EligibilityError::InvalidIssuerGrantSource
    );

    require!(
        is_valid_issuer_permissions(permissions),
        EligibilityError::InvalidIssuerGrantPermissions
    );

    require!(
        max_evidence_ttl_seconds > 0,
        EligibilityError::InvalidIssuerGrantTtl
    );

    require!(
        is_valid_timestamp_window(valid_from_ts, valid_until_ts),
        EligibilityError::InvalidIssuerGrantValidityWindow
    );

    let clock = Clock::get()?;
    let registry_key = ctx.accounts.registry.key();
    let eligibility_class_key = ctx.accounts.eligibility_class.key();
    let issuer_grant_key = ctx.accounts.issuer_grant.key();
    let issuer_grant_bump = ctx.bumps.issuer_grant;

    let registry = &mut ctx.accounts.registry;
    let issuer_grant = &mut ctx.accounts.issuer_grant;

    let is_new_grant = issuer_grant.version == 0;

    if is_new_grant {
        issuer_grant.version = ISSUER_GRANT_VERSION;
        issuer_grant.registry = registry_key;
        issuer_grant.eligibility_class = eligibility_class_key;
        issuer_grant.class_id = class_id;
        issuer_grant.issuer = issuer;
        issuer_grant.allowed_source = allowed_source;

        issuer_grant.created_ts = clock.unix_timestamp;
        issuer_grant.created_slot = clock.slot;
        issuer_grant.created_solana_epoch = clock.epoch;

        issuer_grant.bump = issuer_grant_bump;
        issuer_grant.reserved = [0u8; ISSUER_GRANT_RESERVED_BYTES];
    } else {
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
            issuer_grant.allowed_source == allowed_source,
            EligibilityError::IssuerGrantSourceImmutable
        );
    }

    require!(
        is_valid_class_source(
            ctx.accounts.eligibility_class.class_id,
            ctx.accounts.eligibility_class.kind,
            allowed_source,
        ),
        EligibilityError::EligibilitySourceClassMismatch
    );

    issuer_grant.permissions = permissions;
    issuer_grant.enabled = true;
    issuer_grant.max_evidence_ttl_seconds = max_evidence_ttl_seconds;
    issuer_grant.valid_from_ts = valid_from_ts;
    issuer_grant.valid_until_ts = valid_until_ts;

    issuer_grant.updated_ts = clock.unix_timestamp;
    issuer_grant.updated_slot = clock.slot;
    issuer_grant.updated_solana_epoch = clock.epoch;

    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(IssuerGrantUpserted {
        registry: registry_key,
        eligibility_class: eligibility_class_key,
        issuer_grant: issuer_grant_key,
        authority: ctx.accounts.authority.key(),
        class_id,
        issuer,
        allowed_source,
        permissions,
        enabled: true,
        max_evidence_ttl_seconds,
        valid_from_ts,
        valid_until_ts,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
