use anchor_lang::prelude::*;

#[error_code]
pub enum EligibilityError {
    #[msg("Registry is paused")]
    RegistryPaused,

    #[msg("Registry is not paused")]
    RegistryNotPaused,

    #[msg("Invalid authority")]
    InvalidAuthority,

    #[msg("Invalid governance mode")]
    InvalidGovernanceMode,

    #[msg("Invalid eligibility class kind")]
    InvalidClassKind,

    #[msg("Invalid eligibility class status")]
    InvalidClassStatus,

    #[msg("Invalid eligibility record status")]
    InvalidRecordStatus,

    #[msg("Invalid eligibility source")]
    InvalidEligibilitySource,

    #[msg("Invalid subject kind")]
    InvalidSubjectKind,

    #[msg("Invalid subject key")]
    InvalidSubjectKey,

    #[msg("Invalid class id")]
    InvalidClassId,

    #[msg("Invalid epoch window")]
    InvalidEpochWindow,

    #[msg("Eligibility class is disabled")]
    EligibilityClassDisabled,

    #[msg("Eligibility class does not belong to this registry")]
    ClassRegistryMismatch,

    #[msg("Eligibility record does not belong to this registry")]
    RecordRegistryMismatch,

    #[msg("Eligibility record does not belong to this class")]
    RecordClassMismatch,

    #[msg("Wallet does not match wallet subject key")]
    WalletSubjectMismatch,

    #[msg("New authority cannot be default pubkey")]
    InvalidNewAuthority,

    #[msg("Eligibility record cannot be suspended from its current status")]
    EligibilityRecordNotSuspendable,

    #[msg("Eligibility record is already revoked")]
    EligibilityRecordAlreadyRevoked,

    #[msg("Eligibility class id does not match its class kind")]
    ClassIdKindMismatch,

    #[msg("Eligibility class status and enabled state are inconsistent")]
    InvalidClassState,

    #[msg("Epoch registry is not the canonical Program 1 registry for this Realm")]
    InvalidEpochRegistry,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Eligibility source is not permitted for this eligibility class")]
    EligibilitySourceClassMismatch,
}
