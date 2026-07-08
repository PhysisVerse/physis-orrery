use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ResumeRegistry<'info> {
    /// CHECK: Placeholder account context. Replace during implementation.
    pub placeholder: UncheckedAccount<'info>,
}

pub fn process_resume_registry(_ctx: Context<ResumeRegistry>) -> Result<()> {
    Ok(())
}
