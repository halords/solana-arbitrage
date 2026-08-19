import {
  IInstruction,
  Address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  KeyPairSigner,
  Blockhash,
} from '@solana/kit';
import { ArbitrageOpportunity } from '@solana-arbitrage/domain';

export interface CompiledArbitrageTransaction {
  readonly opportunityId: string;
  readonly feePayer: Address;
  readonly instructionCount: number;
  readonly serializedBytes: Uint8Array;
  readonly byteSize: number;
  readonly isWithinMtuLimit: boolean;
}

export class ArbitrageTransactionBuilder {
  public static readonly SOLANA_MAX_TX_SIZE_BYTES = 1232;

  public createSwapInstruction(
    programId: Address,
    sourceAccount: Address,
    destinationAccount: Address,
    userSigner: Address,
    amountIn: bigint,
    minimumAmountOut: bigint
  ): IInstruction {
    // Pack binary instruction payload for AMM swap (e.g. standard 8-byte amountIn + 8-byte minAmountOut)
    const data = new Uint8Array(17);
    const view = new DataView(data.buffer);
    view.setUint8(0, 9); // Swap instruction index
    view.setBigUint64(1, amountIn, true);
    view.setBigUint64(9, minimumAmountOut, true);

    return {
      programAddress: programId,
      accounts: [
        { address: sourceAccount, role: 3 }, // Writable + Non-signer
        { address: destinationAccount, role: 3 }, // Writable + Non-signer
        { address: userSigner, role: 2 }, // Read-only + Signer
      ],
      data,
    };
  }

  public async buildAtomicArbitrageTransaction(
    opportunity: ArbitrageOpportunity,
    signer: KeyPairSigner,
    latestBlockhash: { blockhash: Blockhash; lastValidBlockHeight: bigint },
    customInstructions?: IInstruction[]
  ): Promise<CompiledArbitrageTransaction> {
    const dummyRaydiumProgram = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' as Address;
    const dummyOrcaProgram = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc' as Address;

    const sourceTokenAccount = signer.address;
    const intermediateAccount = signer.address;
    const finalTokenAccount = signer.address;

    // Leg 1: Buy swap on DEX A
    const leg1Instruction = this.createSwapInstruction(
      dummyRaydiumProgram,
      sourceTokenAccount,
      intermediateAccount,
      signer.address,
      BigInt(100_000_000),
      BigInt(18_000_000)
    );

    // Leg 2: Sell swap on DEX B
    const leg2Instruction = this.createSwapInstruction(
      dummyOrcaProgram,
      intermediateAccount,
      finalTokenAccount,
      signer.address,
      BigInt(18_000_000),
      BigInt(101_000_000)
    );

    const allInstructions = customInstructions
      ? [...customInstructions, leg1Instruction, leg2Instruction]
      : [leg1Instruction, leg2Instruction];

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) => appendTransactionMessageInstructions(allInstructions, m)
    );

    const compiledTx = compileTransaction(message);
    const serializedBytes = new Uint8Array(compiledTx.messageBytes);
    const byteSize = serializedBytes.byteLength;

    return {
      opportunityId: opportunity.id,
      feePayer: signer.address,
      instructionCount: allInstructions.length,
      serializedBytes,
      byteSize,
      isWithinMtuLimit: byteSize <= ArbitrageTransactionBuilder.SOLANA_MAX_TX_SIZE_BYTES,
    };
  }
}
