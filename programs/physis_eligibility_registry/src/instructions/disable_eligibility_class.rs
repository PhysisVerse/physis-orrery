use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct DisableEligibilityClass<'info> {
    /// CHECK: Placeholder account context. Replace during implementation.
    pub placeholder: UncheckedAccount<'info>,
}

pub fn process_disable_eligibility_class(_ctx: Context<DisableEligibilityClass>) -> Result<()> {
    Ok(())
}
