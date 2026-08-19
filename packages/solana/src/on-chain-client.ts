import { Address, IInstruction } from '@solana/kit';

export interface OnChainArbitrageInstructionParams {
  readonly authority: Address;
  readonly userTokenAccount: Address;
  readonly intermediateTokenAccount: Address;
  readonly dexAProgram: Address;
  readonly dexBProgram: Address;
  readonly amountIn: bigint;
  readonly minProfitLamports: bigint;
}

export class OnChainArbitrageProgramClient {
  public static readonly PROGRAM_ID =
    'Arbi1111111111111111111111111111111111111111' as Address;
  public static readonly SPL_TOKEN_PROGRAM_ID =
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;

  /**
   * Builds the binary instruction to execute an atomic on-chain arbitrage swap
   */
  public buildExecuteArbitrageInstruction(
    params: OnChainArbitrageInstructionParams
  ): IInstruction {
    // 8-byte Anchor discriminator for `execute_atomic_arbitrage` + 8-byte amount_in + 8-byte min_profit_lamports
    const data = new Uint8Array(24);
    const view = new DataView(data.buffer);

    // Anchor discriminator hash mock for execute_atomic_arbitrage
    view.setUint32(0, 0x1a2b3c4d, true);
    view.setUint32(4, 0x5e6f7a8b, true);
    view.setBigUint64(8, params.amountIn, true);
    view.setBigUint64(16, params.minProfitLamports, true);

    return {
      programAddress: OnChainArbitrageProgramClient.PROGRAM_ID,
      accounts: [
        { address: params.authority, role: 3 },                  // Writable + Signer
        { address: params.userTokenAccount, role: 1 },           // Writable
        { address: params.intermediateTokenAccount, role: 1 },   // Writable
        { address: params.dexAProgram, role: 0 },                // Read-only
        { address: params.dexBProgram, role: 0 },                // Read-only
        { address: OnChainArbitrageProgramClient.SPL_TOKEN_PROGRAM_ID, role: 0 },
      ],
      data,
    };
  }
}
