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

    /// CHECK: Validated in the processor as the canonical, initialized,
    /// Program 1-owned EpochRegistry for the supplied Realm.
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

fn validate_program1_epoch_registry(
    epoch_registry: &UncheckedAccount<'_>,
    expected_realm: Pubkey,
) -> Result<()> {
    let account_info = epoch_registry.to_account_info();

    require!(
        account_info.lamports() > 0
            && account_info.data_len() >= PROGRAM1_EPOCH_REGISTRY_HEADER_BYTES,
        EligibilityError::EpochRegistryNotInitialized
    );

    require_keys_eq!(
        *account_info.owner,
        PHYSIS_EPOCH_REGISTRY_PROGRAM_ID,
        EligibilityError::InvalidEpochRegistryOwner
    );

    let data = account_info.try_borrow_data()?;

    let discriminator = data
        .get(..ANCHOR_DISCRIMINATOR_BYTES)
        .ok_or_else(|| error!(EligibilityError::EpochRegistryNotInitialized))?;

    require!(
        discriminator == PROGRAM1_EPOCH_REGISTRY_DISCRIMINATOR.as_ref(),
        EligibilityError::InvalidEpochRegistryDiscriminator
    );

    let version = *data
        .get(PROGRAM1_EPOCH_REGISTRY_VERSION_OFFSET)
        .ok_or_else(|| error!(EligibilityError::EpochRegistryNotInitialized))?;

    require!(
        version == PROGRAM1_EPOCH_REGISTRY_VERSION,
        EligibilityError::InvalidEpochRegistryVersion
    );

    let realm_start = PROGRAM1_EPOCH_REGISTRY_REALM_OFFSET;

    let realm_end = realm_start + 32;

    let realm_slice = data
        .get(realm_start..realm_end)
        .ok_or_else(|| error!(EligibilityError::EpochRegistryNotInitialized))?;

    let realm_bytes: [u8; 32] = realm_slice
        .try_into()
        .map_err(|_| error!(EligibilityError::EpochRegistryNotInitialized))?;

    let stored_realm = Pubkey::new_from_array(realm_bytes);

    require_keys_eq!(
        stored_realm,
        expected_realm,
        EligibilityError::EpochRegistryRealmMismatch
    );

    Ok(())
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

    validate_program1_epoch_registry(&ctx.accounts.epoch_registry, realm_key)?;

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
