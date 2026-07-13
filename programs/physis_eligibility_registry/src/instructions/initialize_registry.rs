use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::EligibilityRegistryInitialized;
use crate::state::EligibilityRegistry;

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    /// CHECK: External SPL Governance Realm reference used in PDA derivation.
    pub realm: UncheckedAccount<'info>,

    /// CHECK: Validated in the processor as the canonical Program 1
    /// epoch-registry PDA for the supplied Realm.
    pub epoch_registry: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + EligibilityRegistry::LEN,
        seeds = [
            SEED_PREFIX,
            SEED_ELIGIBILITY_REGISTRY,
            realm.key().as_ref()
        ],
        bump
    )]
    pub registry: Account<'info, EligibilityRegistry>,

    pub system_program: Program<'info, System>,
}

pub fn process_initialize_registry(
    ctx: Context<InitializeRegistry>,
    governance_mode: u8,
) -> Result<()> {
    require!(
        governance_mode == GOVERNANCE_MODE_PRIVE_ONLY,
        EligibilityError::InvalidGovernanceMode
    );

    let realm_key = ctx.accounts.realm.key();

    let (expected_epoch_registry, _) = Pubkey::find_program_address(
        &[SEED_PREFIX, SEED_EPOCH_REGISTRY, realm_key.as_ref()],
        &PHYSIS_EPOCH_REGISTRY_PROGRAM_ID,
    );

    require_keys_eq!(
        ctx.accounts.epoch_registry.key(),
        expected_epoch_registry,
        EligibilityError::InvalidEpochRegistry
    );

    let clock = Clock::get()?;
    let registry_key = ctx.accounts.registry.key();

    let registry = &mut ctx.accounts.registry;

    registry.version = REGISTRY_VERSION;
    registry.realm = realm_key;
    registry.authority = ctx.accounts.authority.key();
    registry.epoch_registry = expected_epoch_registry;
    registry.governance_mode = governance_mode;
    registry.paused = false;
    registry.class_count = 0;
    registry.record_count = 0;

    registry.created_ts = clock.unix_timestamp;
    registry.created_slot = clock.slot;
    registry.created_solana_epoch = clock.epoch;

    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    registry.bump = ctx.bumps.registry;
    registry.reserved = [0u8; RESERVED_BYTES];

    emit!(EligibilityRegistryInitialized {
        registry: registry_key,
        realm: registry.realm,
        authority: registry.authority,
        epoch_registry: registry.epoch_registry,
        governance_mode,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
