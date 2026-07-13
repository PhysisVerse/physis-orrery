#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use solana_security_txt::security_txt;

security_txt! {
    name: "Physis Orrery - Eligibility Registry",
    project_url: "https://github.com/PhysisVerse/physis-orrery",
    contacts: "email:care@phys.is",
    policy: "https://github.com/PhysisVerse/physis-orrery/security/policy",
    preferred_languages: "en",
    source_code: "https://github.com/PhysisVerse/physis-orrery",
    encryption: "",
    auditors: "None",
    acknowledgements: "https://github.com/PhysisVerse/physis-orrery/security/advisories"
}

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

pub use instructions::*;

declare_id!("PHYwVLxfos5STGcSzFe9Jirzy6YiEPPZC3wVKoTHoER");

#[program]
pub mod physis_eligibility_registry {
    use super::*;

    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        governance_mode: u8,
    ) -> Result<()> {
        process_initialize_registry(ctx, governance_mode)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn upsert_eligibility_class(
        ctx: Context<UpsertEligibilityClass>,
        class_id: u32,
        name: [u8; constants::NAME_BYTES],
        label: [u8; constants::LABEL_BYTES],
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
        process_upsert_eligibility_class(
            ctx,
            class_id,
            name,
            label,
            kind,
            status,
            enabled,
            governance_eligible,
            rewards_eligible,
            gate_mint,
            min_amount,
            valid_from_epoch_id,
            valid_until_epoch_id,
        )
    }

    pub fn disable_eligibility_class(
        ctx: Context<DisableEligibilityClass>,
        class_id: u32,
    ) -> Result<()> {
        process_disable_eligibility_class(ctx, class_id)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn upsert_eligibility_record(
        ctx: Context<UpsertEligibilityRecord>,
        class_id: u32,
        subject_kind: u8,
        subject_key: [u8; constants::SUBJECT_KEY_BYTES],
        wallet: Pubkey,
        status: u8,
        source: u8,
        issuer: Pubkey,
        metadata_hash: [u8; constants::METADATA_HASH_BYTES],
        valid_from_epoch_id: u32,
        valid_until_epoch_id: u32,
    ) -> Result<()> {
        process_upsert_eligibility_record(
            ctx,
            class_id,
            subject_kind,
            subject_key,
            wallet,
            status,
            source,
            issuer,
            metadata_hash,
            valid_from_epoch_id,
            valid_until_epoch_id,
        )
    }

    pub fn suspend_eligibility_record(
        ctx: Context<SuspendEligibilityRecord>,
        class_id: u32,
        subject_kind: u8,
        subject_key: [u8; constants::SUBJECT_KEY_BYTES],
    ) -> Result<()> {
        process_suspend_eligibility_record(ctx, class_id, subject_kind, subject_key)
    }

    pub fn revoke_eligibility_record(
        ctx: Context<RevokeEligibilityRecord>,
        class_id: u32,
        subject_kind: u8,
        subject_key: [u8; constants::SUBJECT_KEY_BYTES],
    ) -> Result<()> {
        process_revoke_eligibility_record(ctx, class_id, subject_kind, subject_key)
    }

    pub fn pause_registry(ctx: Context<PauseRegistry>) -> Result<()> {
        process_pause_registry(ctx)
    }

    pub fn resume_registry(ctx: Context<ResumeRegistry>) -> Result<()> {
        process_resume_registry(ctx)
    }

    pub fn transfer_registry_authority(
        ctx: Context<TransferRegistryAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        process_transfer_registry_authority(ctx, new_authority)
    }
}
