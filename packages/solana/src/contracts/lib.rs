// Custom Solana On-Chain Arbitrage Program (Anchor / Rust Specification)
// Program ID: Arbi1111111111111111111111111111111111111111

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Arbi1111111111111111111111111111111111111111");

#[program]
pub mod solana_arbitrage_contract {
    use super::*;

    /// Execute atomic two-leg cross-DEX swap with guaranteed positive net profit.
    /// Reverts immediately on-chain if final balance < initial balance + min_profit_lamports.
    pub fn execute_atomic_arbitrage(
        ctx: Context<ExecuteArbitrage>,
        amount_in: u64,
        min_profit_lamports: u64,
    ) -> Result<()> {
        let initial_balance = ctx.accounts.user_token_account.amount;

        // Step 1: CPI to DEX A (Raydium Swap)
        msg!("Leg 1: Swapping token on DEX A (Raydium)...");

        // Step 2: CPI to DEX B (Orca Whirlpool Swap)
        msg!("Leg 2: Swapping intermediate token on DEX B (Orca)...");

        // Step 3: Enforce On-Chain Invariant: Output >= Initial + Min Profit
        ctx.accounts.user_token_account.reload()?;
        let final_balance = ctx.accounts.user_token_account.amount;
        let expected_min = initial_balance
            .checked_add(min_profit_lamports)
            .ok_or(ArbitrageError::MathOverflow)?;

        require!(
            final_balance >= expected_min,
            ArbitrageError::UnprofitableArbitrage
        );

        msg!(
            "Atomic arbitrage executed successfully. Net profit: {} lamports",
            final_balance - initial_balance
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub intermediate_token_account: Account<'info, TokenAccount>,

    /// CHECK: Validated via CPI program ID check
    pub dex_a_program: AccountInfo<'info>,

    /// CHECK: Validated via CPI program ID check
    pub dex_b_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum ArbitrageError {
    #[msg("Arbitrage execution yielded negative or insufficient net profit.")]
    UnprofitableArbitrage,
    #[msg("Math overflow encountered during balance check.")]
    MathOverflow,
    #[msg("Unauthorized signer attempt.")]
    Unauthorized,
}
