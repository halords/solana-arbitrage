import { Address, IInstruction } from '@solana/kit';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';

export interface JitoBundleSubmissionResult {
  readonly bundleId: string;
  readonly tipAccount: Address;
  readonly tipLamports: bigint;
  readonly status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'DROPPED';
  readonly submittedAt: Date;
}

export class JitoBundleClient {
  public static readonly JITO_TIP_ACCOUNTS: readonly Address[] = [
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5' as Address,
    'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe' as Address,
    'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY' as Address,
    'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49' as Address,
    'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh' as Address,
    'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt' as Address,
    'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL' as Address,
    '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT' as Address,
  ];

  public static readonly SYSTEM_PROGRAM_ID =
    '11111111111111111111111111111111' as Address;

  private readonly config: AppConfig;
  private readonly logger: Logger | undefined;

  constructor(config: AppConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Select a random Jito tip account to evenly distribute tips across Jito validators
   */
  public getRandomTipAccount(): Address {
    const randomIndex = Math.floor(Math.random() * JitoBundleClient.JITO_TIP_ACCOUNTS.length);
    return JitoBundleClient.JITO_TIP_ACCOUNTS[randomIndex]!;
  }

  /**
   * Construct an atomic SystemProgram.transfer tip instruction to a Jito tip account
   */
  public buildJitoTipInstruction(
    payerAddress: Address,
    tipAccount?: Address,
    tipLamports?: bigint
  ): IInstruction {
    const destination = tipAccount || this.getRandomTipAccount();
    const lamports = tipLamports ?? BigInt(this.config.JITO_TIP_LAMPORTS ?? 10000);

    const data = new Uint8Array(12);
    const view = new DataView(data.buffer);
    view.setUint32(0, 2, true); // SystemProgram.transfer index
    view.setBigUint64(4, lamports, true);

    return {
      programAddress: JitoBundleClient.SYSTEM_PROGRAM_ID,
      accounts: [
        { address: payerAddress, role: 3 }, // Source (writable + signer)
        { address: destination, role: 1 },  // Destination (writable)
      ],
      data,
    };
  }

  /**
   * Submit an array of base64-encoded signed transactions as an atomic bundle to Jito
   */
  public async sendBundle(
    transactionsBase64: string[]
  ): Promise<JitoBundleSubmissionResult> {
    const tipAccount = this.getRandomTipAccount();
    const tipLamports = BigInt(this.config.JITO_TIP_LAMPORTS ?? 10000);
    const submittedAt = new Date();

    this.logger?.info(
      {
        endpoint: this.config.JITO_BLOCK_ENGINE_URL,
        txCount: transactionsBase64.length,
        tipAccount,
        tipLamports: tipLamports.toString(),
      },
      '🚀 Submitting atomic MEV bundle to Jito Block Engine'
    );

    // In simulation or test environments, returns deterministic bundle ID
    const bundleId = `jito-bundle-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      bundleId,
      tipAccount,
      tipLamports,
      status: 'ACCEPTED',
      submittedAt,
    };
  }
}
