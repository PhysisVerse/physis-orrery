use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SuspendEligibilityRecord<'info> {
    /// CHECK: Placeholder account context. Replace during implementation.
    pub placeholder: UncheckedAccount<'info>,
}

pub fn process_suspend_eligibility_record(_ctx: Context<SuspendEligibilityRecord>) -> Result<()> {
    Ok(())
}
