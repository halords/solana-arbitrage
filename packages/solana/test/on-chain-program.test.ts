import { describe, it, expect } from 'vitest';
import {
  OnChainArbitrageProgramClient,
  FlashLoanManager,
  AlertingService,
} from '@solana-arbitrage/solana';
import { Address } from '@solana/kit';

describe('Phase 6 Custom On-Chain Program & Flash Loans', () => {
  it('OnChainArbitrageProgramClient constructs valid Anchor CPI instruction', () => {
    const client = new OnChainArbitrageProgramClient();
    const mockAuthority = 'Authority111111111111111111111111111111111' as Address;
    const mockUserToken = 'UserToken111111111111111111111111111111111' as Address;
    const mockInterToken = 'InterToken111111111111111111111111111111111' as Address;

    const ix = client.buildExecuteArbitrageInstruction({
      authority: mockAuthority,
      userTokenAccount: mockUserToken,
      intermediateTokenAccount: mockInterToken,
      dexAProgram: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' as Address,
      dexBProgram: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc' as Address,
      amountIn: BigInt(100_000_000),
      minProfitLamports: BigInt(50_000),
    });

    expect(ix.programAddress).toBe(OnChainArbitrageProgramClient.PROGRAM_ID);
    expect(ix.accounts.length).toBe(6);
    expect(ix.data.length).toBe(24);
  });

  it('FlashLoanManager builds borrow and repay instructions with protocol fee', () => {
    const manager = new FlashLoanManager();
    const mockBorrower = 'Borrower111111111111111111111111111111111' as Address;
    const mockMint = 'So11111111111111111111111111111111111111112' as Address;

    const borrowIx = manager.buildFlashBorrowInstruction({
      borrower: mockBorrower,
      tokenMint: mockMint,
      borrowAmount: BigInt(1_000_000_000), // 1 SOL
      protocol: 'solend',
    });

    expect(borrowIx.programAddress).toBe(FlashLoanManager.SOLEND_PROGRAM_ID);
    expect(borrowIx.data.length).toBe(9);

    const repayIx = manager.buildFlashRepayInstruction(
      {
        borrower: mockBorrower,
        tokenMint: mockMint,
        borrowAmount: BigInt(1_000_000_000),
        protocol: 'solend',
      },
      9 // 9 bps fee
    );

    expect(repayIx.programAddress).toBe(FlashLoanManager.SOLEND_PROGRAM_ID);
    const view = new DataView(repayIx.data.buffer);
    const repayAmount = view.getBigUint64(1, true);
    expect(repayAmount).toBe(BigInt(1_000_900_000)); // 1 SOL + 0.09% fee
  });

  it('AlertingService dispatches notification payloads cleanly', async () => {
    const service = new AlertingService();
    const sent = await service.sendAlert({
      level: 'INFO',
      title: 'Production Arbitrage Alert',
      message: 'Atomic trade filled with profit',
      timestamp: new Date(),
      metadata: { profitUsd: 0.15 },
    });

    expect(sent).toBe(true);
  });
});
