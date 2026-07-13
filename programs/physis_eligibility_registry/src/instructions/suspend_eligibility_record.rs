use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::EligibilityRecordSuspended;
use crate::state::{EligibilityClass, EligibilityRecord, EligibilityRegistry};
use crate::utils::subject::validate_subject;

#[derive(Accounts)]
#[instruction(
    class_id: u32,
    subject_kind: u8,
    subject_key: [u8; SUBJECT_KEY_BYTES]
)]
pub struct SuspendEligibilityRecord<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = !registry.paused
            @ EligibilityError::RegistryPaused,
        constraint = registry.authority == authority.key()
            @ EligibilityError::InvalidAuthority
    )]
    pub registry: Box<Account<'info, EligibilityRegistry>>,

    #[account(
        seeds = [
            SEED_PREFIX,
            SEED_ELIGIBILITY_CLASS,
            registry.key().as_ref(),
            class_id.to_le_bytes().as_ref()
        ],
        bump = eligibility_class.bump,
        constraint = eligibility_class.registry == registry.key()
            @ EligibilityError::ClassRegistryMismatch,
        constraint = eligibility_class.class_id == class_id
            @ EligibilityError::InvalidClassId
    )]
    pub eligibility_class: Box<Account<'info, EligibilityClass>>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            SEED_ELIGIBILITY_RECORD,
            registry.key().as_ref(),
            &[subject_kind],
            subject_key.as_ref(),
            class_id.to_le_bytes().as_ref()
        ],
        bump = eligibility_record.bump,
        constraint = eligibility_record.registry == registry.key()
            @ EligibilityError::RecordRegistryMismatch,
        constraint = eligibility_record.eligibility_class == eligibility_class.key()
            @ EligibilityError::RecordClassMismatch,
        constraint = eligibility_record.class_id == class_id
            @ EligibilityError::InvalidClassId,
        constraint = eligibility_record.subject_kind == subject_kind
            && eligibility_record.subject_key == subject_key
            @ EligibilityError::InvalidSubjectKey
    )]
    pub eligibility_record: Box<Account<'info, EligibilityRecord>>,
}

pub fn process_suspend_eligibility_record(
    ctx: Context<SuspendEligibilityRecord>,
    class_id: u32,
    subject_kind: u8,
    subject_key: [u8; SUBJECT_KEY_BYTES],
) -> Result<()> {
    require!(class_id != 0, EligibilityError::InvalidClassId);

    validate_subject(subject_kind, &subject_key)?;

    require!(
        matches!(
            ctx.accounts.eligibility_record.status,
            RECORD_STATUS_PENDING | RECORD_STATUS_ACTIVE
        ),
        EligibilityError::EligibilityRecordNotSuspendable
    );

    let clock = Clock::get()?;

    let registry_key = ctx.accounts.registry.key();
    let eligibility_class_key = ctx.accounts.eligibility_class.key();
    let eligibility_record_key = ctx.accounts.eligibility_record.key();

    let registry = &mut *ctx.accounts.registry;
    let eligibility_record = &mut *ctx.accounts.eligibility_record;

    eligibility_record.status = RECORD_STATUS_SUSPENDED;
    eligibility_record.updated_ts = clock.unix_timestamp;
    eligibility_record.updated_slot = clock.slot;
    eligibility_record.updated_solana_epoch = clock.epoch;

    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(EligibilityRecordSuspended {
        registry: registry_key,
        eligibility_class: eligibility_class_key,
        eligibility_record: eligibility_record_key,
        class_id,
        subject_kind,
        subject_key,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
