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

    #[msg("PRIVE_MEMBER must remain governance-eligible")]
    PriveClassMustBeGovernanceEligible,

    #[msg("PERSONA_VERIFIED cannot independently be governance-eligible")]
    PersonaClassCannotBeGovernanceEligible,

    #[msg("PERSONA_VERIFIED cannot independently be rewards-eligible")]
    PersonaClassCannotBeRewardsEligible,

    #[msg("Epoch registry is not the canonical Program 1 registry for this Realm")]
    InvalidEpochRegistry,

    #[msg("Program 1 Epoch Registry account does not exist or is not initialized")]
    EpochRegistryNotInitialized,

    #[msg("Program 1 Epoch Registry has an invalid account owner")]
    InvalidEpochRegistryOwner,

    #[msg("Program 1 Epoch Registry has an invalid account discriminator")]
    InvalidEpochRegistryDiscriminator,

    #[msg("Program 1 Epoch Registry uses an unsupported version")]
    InvalidEpochRegistryVersion,

    #[msg("Program 1 Epoch Registry belongs to a different Realm")]
    EpochRegistryRealmMismatch,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Eligibility source is not permitted for this eligibility class")]
    EligibilitySourceClassMismatch,

    #[msg("Issuer cannot be the default pubkey")]
    InvalidIssuer,

    #[msg("Issuer grant uses an unsupported version")]
    InvalidIssuerGrantVersion,

    #[msg("Issuer grant source is not delegatable")]
    InvalidIssuerGrantSource,

    #[msg("Issuer grant permissions are invalid")]
    InvalidIssuerGrantPermissions,

    #[msg("Issuer grant evidence TTL must be greater than zero")]
    InvalidIssuerGrantTtl,

    #[msg("Issuer grant validity window is invalid")]
    InvalidIssuerGrantValidityWindow,

    #[msg("Issuer grant source cannot be changed after creation")]
    IssuerGrantSourceImmutable,

    #[msg("Issuer grant is already disabled")]
    IssuerGrantAlreadyDisabled,

    #[msg("Issuer grant does not belong to this registry")]
    IssuerGrantRegistryMismatch,

    #[msg("Issuer grant does not belong to this eligibility class")]
    IssuerGrantClassMismatch,

    #[msg("Issuer grant belongs to a different issuer")]
    IssuerGrantIssuerMismatch,

    #[msg("Issuer grant is disabled")]
    IssuerGrantDisabled,

    #[msg("Issuer grant is not yet valid")]
    IssuerGrantNotYetValid,

    #[msg("Issuer grant has expired")]
    IssuerGrantExpired,

    #[msg("Issuer grant does not provide the required permission")]
    IssuerPermissionDenied,

    #[msg("Eligibility record uses an unsupported version")]
    InvalidEligibilityRecordVersion,

    #[msg("Evidence metadata hash cannot be all zeroes")]
    InvalidMetadataHash,

    #[msg("Evidence expiry must be a future timestamp")]
    InvalidEvidenceExpiry,

    #[msg("Evidence expiry exceeds the issuer grant TTL")]
    EvidenceExpiryExceedsGrantTtl,

    #[msg("Evidence expiry exceeds the issuer grant validity window")]
    EvidenceExpiryExceedsGrantValidity,

    #[msg("Delegated issuers cannot overwrite DAO governance override records")]
    DelegatedCannotOverwriteDaoOverride,

    #[msg("Existing record source does not match the delegated issuer grant")]
    DelegatedRecordSourceMismatch,

    #[msg("Delegated record transition is not permitted")]
    DelegatedRecordTransitionNotAllowed,

    #[msg("Root-authority record transition is not permitted")]
    RootRecordTransitionNotAllowed,

    #[msg("Eligibility record cannot be explicitly expired from its current status")]
    EligibilityRecordNotExpirable,

    #[msg("Eligibility record is already expired")]
    EligibilityRecordAlreadyExpired,

    #[msg("Eligibility evidence has not reached its expiry timestamp")]
    EvidenceNotYetExpired,
}
