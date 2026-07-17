use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;
use crate::events::EligibilityRecordUpserted;
use crate::state::{EligibilityClass, EligibilityRecord, EligibilityRegistry, IssuerGrant};
use crate::utils::subject::validate_subject;

#[derive(Accounts)]
#[instruction(
    class_id: u32,
    subject_kind: u8,
    subject_key: [u8; SUBJECT_KEY_BYTES]
)]
pub struct UpsertEligibilityRecordByIssuer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub issuer: Signer<'info>,

    #[account(
        mut,
        constraint = !registry.paused
            @ EligibilityError::RegistryPaused
    )]
    pub registry: Box<Account<'info, EligibilityRegistry>>,

    #[account(
        constraint = eligibility_class.registry == registry.key()
            @ EligibilityError::ClassRegistryMismatch,
        constraint = eligibility_class.class_id == class_id
            @ EligibilityError::InvalidClassId,
        constraint = eligibility_class.enabled
            && eligibility_class.status == CLASS_STATUS_ACTIVE
            @ EligibilityError::EligibilityClassDisabled
    )]
    pub eligibility_class: Box<Account<'info, EligibilityClass>>,

    #[account(
        seeds = [
            SEED_PREFIX,
            SEED_ISSUER_GRANT,
            registry.key().as_ref(),
            class_id.to_le_bytes().as_ref(),
            issuer.key().as_ref()
        ],
        bump = issuer_grant.bump,
        constraint = issuer_grant.version == ISSUER_GRANT_VERSION
            @ EligibilityError::InvalidIssuerGrantVersion,
        constraint = issuer_grant.registry == registry.key()
            @ EligibilityError::IssuerGrantRegistryMismatch,
        constraint = issuer_grant.eligibility_class == eligibility_class.key()
            @ EligibilityError::IssuerGrantClassMismatch,
        constraint = issuer_grant.class_id == class_id
            @ EligibilityError::InvalidClassId,
        constraint = issuer_grant.issuer == issuer.key()
            @ EligibilityError::IssuerGrantIssuerMismatch
    )]
    pub issuer_grant: Box<Account<'info, IssuerGrant>>,

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
    pub eligibility_record: Box<Account<'info, EligibilityRecord>>,

    pub system_program: Program<'info, System>,
}

fn required_permission(
    is_new_record: bool,
    existing_status: u8,
    requested_status: u8,
) -> Result<u16> {
    if is_new_record {
        return Ok(ISSUER_PERMISSION_CREATE);
    }

    match (existing_status, requested_status) {
        (RECORD_STATUS_PENDING, RECORD_STATUS_PENDING) => Ok(ISSUER_PERMISSION_REFRESH),
        (RECORD_STATUS_PENDING, RECORD_STATUS_ACTIVE) => Ok(ISSUER_PERMISSION_ACTIVATE_PENDING),
        (RECORD_STATUS_ACTIVE, RECORD_STATUS_ACTIVE) => Ok(ISSUER_PERMISSION_REFRESH),
        _ => err!(EligibilityError::DelegatedRecordTransitionNotAllowed),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn process_upsert_eligibility_record_by_issuer(
    ctx: Context<UpsertEligibilityRecordByIssuer>,
    class_id: u32,
    subject_kind: u8,
    subject_key: [u8; SUBJECT_KEY_BYTES],
    wallet: Pubkey,
    status: u8,
    metadata_hash: [u8; METADATA_HASH_BYTES],
    valid_from_epoch_id: u32,
    valid_until_epoch_id: u32,
    evidence_expires_at: i64,
) -> Result<()> {
    require!(class_id != 0, EligibilityError::InvalidClassId);

    validate_subject(subject_kind, &subject_key)?;

    require!(
        is_valid_record_upsert_status(status),
        EligibilityError::InvalidRecordStatus
    );

    require!(
        is_valid_epoch_window(valid_from_epoch_id, valid_until_epoch_id),
        EligibilityError::InvalidEpochWindow
    );

    require!(
        subject_key == wallet.to_bytes(),
        EligibilityError::WalletSubjectMismatch
    );

    require!(
        !is_zero_metadata_hash(&metadata_hash),
        EligibilityError::InvalidMetadataHash
    );

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let issuer_grant = &ctx.accounts.issuer_grant;

    require!(issuer_grant.enabled, EligibilityError::IssuerGrantDisabled);

    require!(
        now >= issuer_grant.valid_from_ts,
        EligibilityError::IssuerGrantNotYetValid
    );

    require!(
        issuer_grant.valid_until_ts == 0 || now < issuer_grant.valid_until_ts,
        EligibilityError::IssuerGrantExpired
    );

    require!(
        evidence_expires_at > now,
        EligibilityError::InvalidEvidenceExpiry
    );

    let max_evidence_expiry = now
        .checked_add(i64::from(issuer_grant.max_evidence_ttl_seconds))
        .ok_or(EligibilityError::MathOverflow)?;

    require!(
        evidence_expires_at <= max_evidence_expiry,
        EligibilityError::EvidenceExpiryExceedsGrantTtl
    );

    require!(
        issuer_grant.valid_until_ts == 0 || evidence_expires_at <= issuer_grant.valid_until_ts,
        EligibilityError::EvidenceExpiryExceedsGrantValidity
    );

    let source = issuer_grant.allowed_source;

    require!(
        is_valid_class_source(
            ctx.accounts.eligibility_class.class_id,
            ctx.accounts.eligibility_class.kind,
            source,
        ),
        EligibilityError::EligibilitySourceClassMismatch
    );

    let registry_key = ctx.accounts.registry.key();
    let eligibility_class_key = ctx.accounts.eligibility_class.key();
    let eligibility_record_key = ctx.accounts.eligibility_record.key();
    let issuer_key = ctx.accounts.issuer.key();
    let eligibility_record_bump = ctx.bumps.eligibility_record;

    let registry = &mut ctx.accounts.registry;
    let eligibility_record = &mut ctx.accounts.eligibility_record;
    let is_new_record = eligibility_record.version == 0;

    if !is_new_record {
        require!(
            eligibility_record.version == ELIGIBILITY_RECORD_VERSION,
            EligibilityError::InvalidEligibilityRecordVersion
        );

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

        require!(
            eligibility_record.source != ELIGIBILITY_SOURCE_DAO_GOVERNANCE_OVERRIDE,
            EligibilityError::DelegatedCannotOverwriteDaoOverride
        );

        require!(
            eligibility_record.source == source,
            EligibilityError::DelegatedRecordSourceMismatch
        );
    }

    let permission = required_permission(is_new_record, eligibility_record.status, status)?;

    require!(
        has_issuer_permission(issuer_grant.permissions, permission),
        EligibilityError::IssuerPermissionDenied
    );

    if is_new_record {
        registry.record_count = registry
            .record_count
            .checked_add(1)
            .ok_or(EligibilityError::MathOverflow)?;

        eligibility_record.registry = registry_key;
        eligibility_record.eligibility_class = eligibility_class_key;
        eligibility_record.class_id = class_id;
        eligibility_record.subject_kind = subject_kind;
        eligibility_record.subject_key = subject_key;
        eligibility_record.created_ts = now;
        eligibility_record.created_slot = clock.slot;
        eligibility_record.created_solana_epoch = clock.epoch;
        eligibility_record.bump = eligibility_record_bump;
        eligibility_record.reserved = [0u8; ELIGIBILITY_RECORD_RESERVED_BYTES];
    }

    eligibility_record.version = ELIGIBILITY_RECORD_VERSION;
    eligibility_record.wallet = wallet;
    eligibility_record.status = status;
    eligibility_record.source = source;
    eligibility_record.issuer = issuer_key;
    eligibility_record.metadata_hash = metadata_hash;
    eligibility_record.valid_from_epoch_id = valid_from_epoch_id;
    eligibility_record.valid_until_epoch_id = valid_until_epoch_id;
    eligibility_record.evidence_issued_at = now;
    eligibility_record.evidence_expires_at = evidence_expires_at;
    eligibility_record.updated_ts = now;
    eligibility_record.updated_slot = clock.slot;
    eligibility_record.updated_solana_epoch = clock.epoch;

    registry.updated_ts = now;
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
        issuer: issuer_key,
        auth_kind: AUTH_KIND_DELEGATED_ISSUER,
        metadata_hash,
        evidence_issued_at: now,
        evidence_expires_at,
        valid_from_epoch_id,
        valid_until_epoch_id,
        timestamp: now,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
