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

// TODO: Replace with final PHY...oEL vanity program id before build/deploy.
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

    pub fn upsert_eligibility_class(ctx: Context<UpsertEligibilityClass>) -> Result<()> {
        process_upsert_eligibility_class(ctx)
    }

    pub fn disable_eligibility_class(ctx: Context<DisableEligibilityClass>) -> Result<()> {
        process_disable_eligibility_class(ctx)
    }

    pub fn upsert_eligibility_record(ctx: Context<UpsertEligibilityRecord>) -> Result<()> {
        process_upsert_eligibility_record(ctx)
    }

    pub fn suspend_eligibility_record(ctx: Context<SuspendEligibilityRecord>) -> Result<()> {
        process_suspend_eligibility_record(ctx)
    }

    pub fn revoke_eligibility_record(ctx: Context<RevokeEligibilityRecord>) -> Result<()> {
        process_revoke_eligibility_record(ctx)
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
