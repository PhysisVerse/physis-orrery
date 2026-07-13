use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::EligibilityRecordUpserted;
use crate::state::{EligibilityClass, EligibilityRecord, EligibilityRegistry};
use crate::utils::subject::validate_subject;

#[derive(Accounts)]
#[instruction(
    class_id: u32,
    subject_kind: u8,
    subject_key: [u8; SUBJECT_KEY_BYTES]
)]
pub struct UpsertEligibilityRecord<'info> {
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
        space = 8 + EligibilityRecord::LEN,
        seeds = [
            SEED_PREFIX,
            SEED_ELIGIBILITY_RECORD,
            registry.key().as_ref(),
            &[subject_kind],
            subject_key.as_ref(),
            class_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub eligibility_record: Account<'info, EligibilityRecord>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn process_upsert_eligibility_record(
    ctx: Context<UpsertEligibilityRecord>,
    class_id: u32,
    subject_kind: u8,
    subject_key: [u8; SUBJECT_KEY_BYTES],
    wallet: Pubkey,
    status: u8,
    source: u8,
    issuer: Pubkey,
    metadata_hash: [u8; METADATA_HASH_BYTES],
    valid_from_epoch_id: u32,
    valid_until_epoch_id: u32,
) -> Result<()> {
    require!(class_id != 0, EligibilityError::InvalidClassId);

    validate_subject(subject_kind, &subject_key)?;

    require!(
        is_valid_record_upsert_status(status),
        EligibilityError::InvalidRecordStatus
    );

    require!(
        is_valid_eligibility_source(source),
        EligibilityError::InvalidEligibilitySource
    );

    require!(
        is_valid_class_source(
            ctx.accounts.eligibility_class.class_id,
            ctx.accounts.eligibility_class.kind,
            source,
        ),
        EligibilityError::EligibilitySourceClassMismatch
    );

    require!(
        is_valid_epoch_window(valid_from_epoch_id, valid_until_epoch_id,),
        EligibilityError::InvalidEpochWindow
    );

    require!(
        subject_key == wallet.to_bytes(),
        EligibilityError::WalletSubjectMismatch
    );

    let clock = Clock::get()?;

    let registry_key = ctx.accounts.registry.key();
    let eligibility_class_key = ctx.accounts.eligibility_class.key();
    let eligibility_record_key = ctx.accounts.eligibility_record.key();
    let eligibility_record_bump = ctx.bumps.eligibility_record;

    let registry = &mut ctx.accounts.registry;
    let eligibility_record = &mut ctx.accounts.eligibility_record;

    let is_new_record = eligibility_record.version == 0;

    if !is_new_record {
        require_keys_eq!(
            eligibility_record.registry,
            registry_key,
            EligibilityError::RecordRegistryMismatch
        );

        require_keys_eq!(
            eligibility_record.eligibility_class,
            eligibility_class_key,
            EligibilityError::RecordClassMismatch
        );

        require!(
            eligibility_record.class_id == class_id,
            EligibilityError::InvalidClassId
        );

        require!(
            eligibility_record.subject_kind == subject_kind
                && eligibility_record.subject_key == subject_key,
            EligibilityError::InvalidSubjectKey
        );
    }

    if is_new_record {
        registry.record_count = registry
            .record_count
            .checked_add(1)
            .ok_or(EligibilityError::MathOverflow)?;

        eligibility_record.version = ELIGIBILITY_RECORD_VERSION;
        eligibility_record.registry = registry_key;
        eligibility_record.eligibility_class = eligibility_class_key;
        eligibility_record.class_id = class_id;
        eligibility_record.subject_kind = subject_kind;
        eligibility_record.subject_key = subject_key;

        eligibility_record.created_ts = clock.unix_timestamp;
        eligibility_record.created_slot = clock.slot;
        eligibility_record.created_solana_epoch = clock.epoch;

        eligibility_record.bump = eligibility_record_bump;
        eligibility_record.reserved = [0u8; RESERVED_BYTES];
    }

    eligibility_record.wallet = wallet;
    eligibility_record.status = status;
    eligibility_record.source = source;
    eligibility_record.issuer = issuer;
    eligibility_record.metadata_hash = metadata_hash;
    eligibility_record.valid_from_epoch_id = valid_from_epoch_id;
    eligibility_record.valid_until_epoch_id = valid_until_epoch_id;

    eligibility_record.updated_ts = clock.unix_timestamp;
    eligibility_record.updated_slot = clock.slot;
    eligibility_record.updated_solana_epoch = clock.epoch;

    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(EligibilityRecordUpserted {
        registry: registry_key,
        eligibility_class: eligibility_class_key,
        eligibility_record: eligibility_record_key,
        class_id,
        subject_kind,
        subject_key,
        wallet,
        status,
        source,
        valid_from_epoch_id,
        valid_until_epoch_id,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
