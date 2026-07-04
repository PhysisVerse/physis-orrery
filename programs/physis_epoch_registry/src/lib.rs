use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

pub use instructions::*;

declare_id!("PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE");

#[program]
pub mod physis_epoch_registry {
    use super::*;

    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        physis_year_start_month: u8,
        physis_year_start_day: u8,
        astralis_epoch_zero_ts: i64,
        astralis_epoch_duration_seconds: i64,
    ) -> Result<()> {
        process_initialize_registry(
            ctx,
            physis_year_start_month,
            physis_year_start_day,
            astralis_epoch_zero_ts,
            astralis_epoch_duration_seconds,
        )
    }

    pub fn register_epoch(
        ctx: Context<RegisterEpoch>,
        epoch_id: u32,
        calendar_year: u16,
        calendar_quarter: u8,
        physis_year: u16,
        physis_quarter: u8,
        label: [u8; constants::LABEL_BYTES],
        start_ts: i64,
        end_ts: i64,
    ) -> Result<()> {
        process_register_epoch(
            ctx,
            epoch_id,
            calendar_year,
            calendar_quarter,
            physis_year,
            physis_quarter,
            label,
            start_ts,
            end_ts,
        )
    }

    pub fn activate_epoch(ctx: Context<ActivateEpoch>) -> Result<()> {
        process_activate_epoch(ctx)
    }

    pub fn close_epoch(ctx: Context<CloseEpoch>) -> Result<()> {
        process_close_epoch(ctx)
    }

    pub fn pause_registry(ctx: Context<PauseRegistry>) -> Result<()> {
        process_pause_registry(ctx)
    }

    pub fn resume_registry(ctx: Context<ResumeRegistry>) -> Result<()> {
        process_resume_registry(ctx)
    }
}
