use anchor_lang::prelude::*;

#[error_code]
pub enum OrreryError {
    #[msg("Invalid authority")]
    InvalidAuthority,

    #[msg("Registry is paused")]
    RegistryPaused,

    #[msg("Registry is not paused")]
    RegistryNotPaused,

    #[msg("Invalid Physis year start")]
    InvalidPhysisYearStart,

    #[msg("Invalid ASTRALIS epoch configuration")]
    InvalidAstralisEpochConfig,

    #[msg("Invalid epoch id")]
    InvalidEpochId,

    #[msg("Invalid calendar quarter")]
    InvalidCalendarQuarter,

    #[msg("Invalid Physis quarter")]
    InvalidPhysisQuarter,

    #[msg("Invalid epoch timestamps")]
    InvalidEpochTimestamps,

    #[msg("Epoch is not pending")]
    EpochNotPending,

    #[msg("Epoch is not active")]
    EpochNotActive,

    #[msg("Epoch has not started")]
    EpochHasNotStarted,

    #[msg("Epoch has not ended")]
    EpochHasNotEnded,

    #[msg("Another epoch is already active")]
    ActiveEpochAlreadySet,

    #[msg("Epoch does not match current active epoch")]
    EpochIsNotCurrent,

    #[msg("Math overflow")]
    MathOverflow,
}
