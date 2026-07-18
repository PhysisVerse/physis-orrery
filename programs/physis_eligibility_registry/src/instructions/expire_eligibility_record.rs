use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::EligibilityRecordExpired;
use crate::state::{EligibilityClass, EligibilityRecord, EligibilityRegistry};
use crate::utils::subject::validate_subject;

#[derive(Accounts)]
#[instruction(
    class_id: u32,
    subject_kind: u8,
    subject_key: [u8; SUBJECT_KEY_BYTES]
)]
pub struct ExpireEligibilityRecord<'info> {
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

pub fn process_expire_eligibility_record(
    ctx: Context<ExpireEligibilityRecord>,
    class_id: u32,
    subject_kind: u8,
    subject_key: [u8; SUBJECT_KEY_BYTES],
) -> Result<()> {
    require!(class_id != 0, EligibilityError::InvalidClassId);
    validate_subject(subject_kind, &subject_key)?;

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let eligibility_record = &ctx.accounts.eligibility_record;

    require!(
        eligibility_record.version == ELIGIBILITY_RECORD_VERSION,
        EligibilityError::InvalidEligibilityRecordVersion
    );
    require!(
        eligibility_record.status != RECORD_STATUS_EXPIRED,
        EligibilityError::EligibilityRecordAlreadyExpired
    );
    require!(
        matches!(
            eligibility_record.status,
            RECORD_STATUS_PENDING | RECORD_STATUS_ACTIVE
        ) && eligibility_record.evidence_expires_at != 0,
        EligibilityError::EligibilityRecordNotExpirable
    );
    require!(
        now >= eligibility_record.evidence_expires_at,
        EligibilityError::EvidenceNotYetExpired
    );

    let registry_key = ctx.accounts.registry.key();
    let eligibility_class_key = ctx.accounts.eligibility_class.key();
    let eligibility_record_key = ctx.accounts.eligibility_record.key();
    let authority_key = ctx.accounts.authority.key();
    let source = eligibility_record.source;
    let evidence_expires_at = eligibility_record.evidence_expires_at;

    let registry = &mut ctx.accounts.registry;
    let eligibility_record = &mut ctx.accounts.eligibility_record;

    eligibility_record.status = RECORD_STATUS_EXPIRED;
    eligibility_record.updated_ts = now;
    eligibility_record.updated_slot = clock.slot;
    eligibility_record.updated_solana_epoch = clock.epoch;

    registry.updated_ts = now;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(EligibilityRecordExpired {
        registry: registry_key,
        eligibility_class: eligibility_class_key,
        eligibility_record: eligibility_record_key,
        class_id,
        subject_kind,
        subject_key,
        actor: authority_key,
        auth_kind: AUTH_KIND_ROOT,
        source,
        evidence_expires_at,
        timestamp: now,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
