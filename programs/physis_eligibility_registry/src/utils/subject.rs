use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::EligibilityError;

pub fn validate_subject(subject_kind: u8, subject_key: &[u8; SUBJECT_KEY_BYTES]) -> Result<()> {
    require!(
        subject_kind == SUBJECT_KIND_WALLET,
        EligibilityError::InvalidSubjectKind
    );

    require!(
        subject_key.iter().any(|byte| *byte != 0),
        EligibilityError::InvalidSubjectKey
    );

    Ok(())
}
