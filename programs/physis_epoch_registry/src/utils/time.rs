use anchor_lang::prelude::*;

use crate::errors::OrreryError;

pub fn derive_astralis_epoch_index(
    current_ts: i64,
    epoch_zero_ts: i64,
    duration_seconds: i64,
) -> Result<i64> {
    require!(
        duration_seconds > 0,
        OrreryError::InvalidAstralisEpochConfig
    );

    let elapsed = current_ts
        .checked_sub(epoch_zero_ts)
        .ok_or(OrreryError::MathOverflow)?;

    Ok(elapsed.div_euclid(duration_seconds))
}

pub fn expected_epoch_id(physis_year: u16, physis_quarter: u8) -> Result<u32> {
    require!(
        (1..=4).contains(&physis_quarter),
        OrreryError::InvalidPhysisQuarter
    );

    let year = u32::from(physis_year);
    let quarter = u32::from(physis_quarter);

    year.checked_mul(100)
        .and_then(|v| v.checked_add(quarter))
        .ok_or(OrreryError::MathOverflow.into())
}
