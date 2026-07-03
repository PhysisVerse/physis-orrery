use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::OrreryError;
use crate::events::RegistryPaused;
use crate::state::EpochRegistry;

#[derive(Accounts)]
pub struct PauseRegistry<'info> {
    pub authority: Signer<'info>,

    #[account(
		mut,
		seeds = [
			SEED_PREFIX,
			SEED_EPOCH_REGISTRY,
			registry.realm.as_ref()
		],
		bump = registry.bump
	)]
    pub registry: Account<'info, EpochRegistry>,
}

pub fn process_pause_registry(ctx: Context<PauseRegistry>) -> Result<()> {
    let registry = &mut ctx.accounts.registry;

    validate_authority(registry.authority, ctx.accounts.authority.key())?;

    require!(!registry.paused, OrreryError::RegistryPaused);

    registry.paused = true;

    emit!(RegistryPaused {
        registry: registry.key(),
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}
