import {
  Address,
  Rpc,
  SolanaRpcApi,
  KeyPairSigner,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  IInstruction,
} from '@solana/kit';
import { Logger } from 'pino';

export interface DrainResult {
  readonly success: boolean;
  readonly amountLamports: bigint;
  readonly amountSol: number;
  readonly destinationAddress: Address;
  readonly serializedBytes?: Uint8Array;
  readonly error?: string;
}

export class EmergencyDrainService {
  private readonly logger: Logger | undefined;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Construct a transfer instruction to sweep all SOL (minus rent-exempt reserve) to cold storage.
   * Returns the serialized transaction bytes ready for signing and broadcast.
   */
  public async buildDrainTransaction(
    rpc: Rpc<SolanaRpcApi>,
    signer: KeyPairSigner,
    destinationAddress: Address
  ): Promise<DrainResult> {
    try {
      // 1. Fetch current balance
      const balanceResult = await rpc.getBalance(signer.address).send();
      const currentLamports = balanceResult.value;

      // Reserve 5000 lamports for the transfer fee
      const transferFeeLamports = BigInt(5000);
      const drainAmount = currentLamports - transferFeeLamports;

      if (drainAmount <= BigInt(0)) {
        this.logger?.warn(
          { currentLamports: currentLamports.toString() },
          '⚠️ Wallet balance too low to drain (insufficient for tx fee)'
        );
        return {
          success: false,
          amountLamports: BigInt(0),
          amountSol: 0,
          destinationAddress,
          error: 'Insufficient balance for drain transaction fee',
        };
      }

      // 2. Construct SystemProgram.transfer instruction
      // System Program ID: 11111111111111111111111111111111
      const systemProgramId = '11111111111111111111111111111111' as Address;

      // Transfer instruction layout:
      // [0..3]  u32 instruction index (2 = Transfer)
      // [4..11] u64 lamports amount (little-endian)
      const data = new Uint8Array(12);
      const view = new DataView(data.buffer);
      view.setUint32(0, 2, true); // Transfer instruction index
      view.setBigUint64(4, drainAmount, true);

      const transferInstruction: IInstruction = {
        programAddress: systemProgramId,
        accounts: [
          { address: signer.address, role: 3 },       // source (writable + signer via fee payer)
          { address: destinationAddress, role: 1 },    // destination (writable)
        ],
        data,
      };

      // 3. Build versioned transaction
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        (m) => appendTransactionMessageInstructions([transferInstruction], m)
      );

      const compiledTx = compileTransaction(message);
      const serializedBytes = new Uint8Array(compiledTx.messageBytes);

      const drainSol = Number(drainAmount) / 1_000_000_000;

      this.logger?.info(
        {
          from: signer.address,
          to: destinationAddress,
          amountSol: drainSol.toFixed(6),
          amountLamports: drainAmount.toString(),
        },
        '🚨 Emergency drain transaction constructed'
      );

      return {
        success: true,
        amountLamports: drainAmount,
        amountSol: parseFloat(drainSol.toFixed(6)),
        destinationAddress,
        serializedBytes,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger?.error({ err: errorMessage }, '❌ Emergency drain transaction construction failed');

      return {
        success: false,
        amountLamports: BigInt(0),
        amountSol: 0,
        destinationAddress,
        error: errorMessage,
      };
    }
  }
}
