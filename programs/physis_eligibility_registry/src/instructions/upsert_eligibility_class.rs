use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::EligibilityClassUpserted;
use crate::state::{EligibilityClass, EligibilityRegistry};

#[derive(Accounts)]
#[instruction(class_id: u32)]
pub struct UpsertEligibilityClass<'info> {
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
        init_if_needed,
        payer = payer,
        space = 8 + EligibilityClass::LEN,
        seeds = [
            SEED_PREFIX,
            SEED_ELIGIBILITY_CLASS,
            registry.key().as_ref(),
            class_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub eligibility_class: Account<'info, EligibilityClass>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn process_upsert_eligibility_class(
    ctx: Context<UpsertEligibilityClass>,
    class_id: u32,
    name: [u8; NAME_BYTES],
    label: [u8; LABEL_BYTES],
    kind: u8,
    status: u8,
    enabled: bool,
    governance_eligible: bool,
    rewards_eligible: bool,
    gate_mint: Pubkey,
    min_amount: u64,
    valid_from_epoch_id: u32,
    valid_until_epoch_id: u32,
) -> Result<()> {
    require!(class_id != 0, EligibilityError::InvalidClassId);

    require!(
        is_valid_class_kind(kind),
        EligibilityError::InvalidClassKind
    );

    require!(
        is_valid_class_identity(class_id, kind),
        EligibilityError::ClassIdKindMismatch
    );

    require!(
        is_valid_class_status(status),
        EligibilityError::InvalidClassStatus
    );

    require!(
        is_valid_class_state(status, enabled),
        EligibilityError::InvalidClassState
    );

    require!(
        is_valid_epoch_window(valid_from_epoch_id, valid_until_epoch_id),
        EligibilityError::InvalidEpochWindow
    );

    match class_id {
        CLASS_ID_PRIVE_MEMBER => {
            require!(
                governance_eligible,
                EligibilityError::PriveClassMustBeGovernanceEligible
            );
        }
        CLASS_ID_PERSONA_VERIFIED => {
            require!(
                !governance_eligible,
                EligibilityError::PersonaClassCannotBeGovernanceEligible
            );

            require!(
                !rewards_eligible,
                EligibilityError::PersonaClassCannotBeRewardsEligible
            );
        }
        _ => {}
    }

    let clock = Clock::get()?;

    let registry_key = ctx.accounts.registry.key();
    let eligibility_class_key = ctx.accounts.eligibility_class.key();
    let eligibility_class_bump = ctx.bumps.eligibility_class;

    let registry = &mut ctx.accounts.registry;
    let eligibility_class = &mut ctx.accounts.eligibility_class;

    let is_new_class = eligibility_class.version == 0;

    if is_new_class {
        registry.class_count = registry
            .class_count
            .checked_add(1)
            .ok_or(EligibilityError::MathOverflow)?;

        eligibility_class.version = ELIGIBILITY_CLASS_VERSION;
        eligibility_class.registry = registry_key;
        eligibility_class.class_id = class_id;

        eligibility_class.created_ts = clock.unix_timestamp;
        eligibility_class.created_slot = clock.slot;
        eligibility_class.created_solana_epoch = clock.epoch;

        eligibility_class.bump = eligibility_class_bump;
        eligibility_class.reserved = [0u8; RESERVED_BYTES];
    } else {
        require_keys_eq!(
            eligibility_class.registry,
            registry_key,
            EligibilityError::ClassRegistryMismatch
        );

        require!(
            eligibility_class.class_id == class_id,
            EligibilityError::InvalidClassId
        );
    }

    eligibility_class.name = name;
    eligibility_class.label = label;
    eligibility_class.kind = kind;
    eligibility_class.status = status;
    eligibility_class.enabled = enabled;
    eligibility_class.governance_eligible = governance_eligible;
    eligibility_class.rewards_eligible = rewards_eligible;
    eligibility_class.gate_mint = gate_mint;
    eligibility_class.min_amount = min_amount;
    eligibility_class.valid_from_epoch_id = valid_from_epoch_id;
    eligibility_class.valid_until_epoch_id = valid_until_epoch_id;

    eligibility_class.updated_ts = clock.unix_timestamp;
    eligibility_class.updated_slot = clock.slot;
    eligibility_class.updated_solana_epoch = clock.epoch;

    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(EligibilityClassUpserted {
        registry: registry_key,
        eligibility_class: eligibility_class_key,
        class_id,
        kind,
        status,
        enabled,
        governance_eligible,
        rewards_eligible,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
