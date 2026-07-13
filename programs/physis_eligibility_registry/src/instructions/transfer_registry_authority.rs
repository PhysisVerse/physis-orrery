use anchor_lang::prelude::*;

use crate::errors::EligibilityError;
use crate::events::EligibilityRegistryAuthorityTransferred;
use crate::state::EligibilityRegistry;

#[derive(Accounts)]
pub struct TransferRegistryAuthority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = registry.authority == authority.key()
            @ EligibilityError::InvalidAuthority
    )]
    pub registry: Account<'info, EligibilityRegistry>,
}

pub fn process_transfer_registry_authority(
    ctx: Context<TransferRegistryAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    require!(
        new_authority != Pubkey::default(),
        EligibilityError::InvalidNewAuthority
    );

    let clock = Clock::get()?;
    let registry_key = ctx.accounts.registry.key();

    let registry = &mut ctx.accounts.registry;
    let old_authority = registry.authority;

    registry.authority = new_authority;
    registry.updated_ts = clock.unix_timestamp;
    registry.updated_slot = clock.slot;
    registry.updated_solana_epoch = clock.epoch;

    emit!(EligibilityRegistryAuthorityTransferred {
        registry: registry_key,
        old_authority,
        new_authority,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
        solana_epoch: clock.epoch,
    });

    Ok(())
}
