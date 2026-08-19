import { Address, IInstruction } from '@solana/kit';

export interface FlashLoanParams {
  readonly borrower: Address;
  readonly tokenMint: Address;
  readonly borrowAmount: bigint;
  readonly protocol: 'solend' | 'marginfi' | 'kamino';
}

export class FlashLoanManager {
  public static readonly SOLEND_PROGRAM_ID =
    'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo' as Address;
  public static readonly MARGINFI_PROGRAM_ID =
    'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA' as Address;

  /**
   * Build borrow instruction for flash loan provider
   */
  public buildFlashBorrowInstruction(params: FlashLoanParams): IInstruction {
    const programId =
      params.protocol === 'solend'
        ? FlashLoanManager.SOLEND_PROGRAM_ID
        : FlashLoanManager.MARGINFI_PROGRAM_ID;

    const data = new Uint8Array(9);
    const view = new DataView(data.buffer);
    view.setUint8(0, 18); // FlashBorrow opcode
    view.setBigUint64(1, params.borrowAmount, true);

    return {
      programAddress: programId,
      accounts: [
        { address: params.borrower, role: 3 },
        { address: params.tokenMint, role: 0 },
      ],
      data,
    };
  }

  /**
   * Build repay instruction with protocol fee
   */
  public buildFlashRepayInstruction(params: FlashLoanParams, feeBps = 9): IInstruction {
    const programId =
      params.protocol === 'solend'
        ? FlashLoanManager.SOLEND_PROGRAM_ID
        : FlashLoanManager.MARGINFI_PROGRAM_ID;

    // Repay amount = borrowAmount + (borrowAmount * feeBps / 10000)
    const feeAmount = (params.borrowAmount * BigInt(feeBps)) / BigInt(10_000);
    const totalRepay = params.borrowAmount + feeAmount;

    const data = new Uint8Array(9);
    const view = new DataView(data.buffer);
    view.setUint8(0, 19); // FlashRepay opcode
    view.setBigUint64(1, totalRepay, true);

    return {
      programAddress: programId,
      accounts: [
        { address: params.borrower, role: 3 },
        { address: params.tokenMint, role: 0 },
      ],
      data,
    };
  }
}
