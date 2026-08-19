import { generateKeyPairSigner, createKeyPairSignerFromBytes, KeyPairSigner, Address } from '@solana/kit';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';
import fs from 'node:fs';

export interface WalletBalanceInfo {
  readonly address: Address;
  readonly lamports: bigint;
  readonly sol: number;
  readonly needsAirdrop: boolean;
}

export class DevnetWalletManager {
  private readonly config: AppConfig;
  private readonly logger: Logger | undefined;
  private signer: KeyPairSigner | null = null;

  constructor(config: AppConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  public async initializeSigner(): Promise<KeyPairSigner> {
    if (this.signer) {
      return this.signer;
    }

    // 1. Try loading from file if DEVNET_KEYPAIR_PATH is specified
    if (this.config.DEVNET_KEYPAIR_PATH) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (fs.existsSync(this.config.DEVNET_KEYPAIR_PATH)) {
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          const raw = fs.readFileSync(this.config.DEVNET_KEYPAIR_PATH, 'utf-8');
          const bytes = new Uint8Array(JSON.parse(raw) as number[]);
          this.signer = await createKeyPairSignerFromBytes(bytes);
          this.logger?.info({ address: this.signer.address }, 'Loaded Devnet keypair from file');
          return this.signer;
        }
      } catch (err: unknown) {
        this.logger?.warn({ err }, 'Failed to parse DEVNET_KEYPAIR_PATH, falling back to ephemeral keypair');
      }
    }

    // 2. Generate an isolated ephemeral Devnet Keypair
    this.signer = await generateKeyPairSigner();
    this.logger?.info(
      { address: this.signer.address },
      'Generated isolated in-memory Devnet keypair signer'
    );

    return this.signer;
  }

  public getSigner(): KeyPairSigner {
    if (!this.signer) {
      throw new Error('DevnetWalletManager not initialized. Call initializeSigner() first.');
    }
    return this.signer;
  }

  public getPublicKeyAddress(): Address {
    return this.getSigner().address;
  }

  public evaluateAirdropNeed(lamports: bigint): WalletBalanceInfo {
    const sol = Number(lamports) / 1_000_000_000;
    const minSol = this.config.MIN_DEVNET_SOL ?? 0.5;
    const needsAirdrop = sol < minSol;

    return {
      address: this.getPublicKeyAddress(),
      lamports,
      sol: parseFloat(sol.toFixed(4)),
      needsAirdrop,
    };
  }
}
