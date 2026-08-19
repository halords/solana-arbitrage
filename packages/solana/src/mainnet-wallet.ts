import { generateKeyPairSigner, createKeyPairSignerFromBytes, KeyPairSigner, Address, Rpc, SolanaRpcApi } from '@solana/kit';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';
import fs from 'node:fs';
import path from 'node:path';

export interface MainnetWalletBalance {
  readonly address: Address;
  readonly lamports: bigint;
  readonly sol: number;
  readonly hasSufficientFunds: boolean;
}

export interface WalletSetupResult {
  readonly hotWalletAddress: Address;
  readonly coldStorageAddress: Address | null;
  readonly keypairPath: string;
}

export class MainnetWalletManager {
  private readonly config: AppConfig;
  private readonly logger: Logger | undefined;
  private signer: KeyPairSigner | null = null;

  constructor(config: AppConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the mainnet hot wallet signer.
   * Loads from MAINNET_KEYPAIR_PATH if it exists, otherwise generates a fresh keypair
   * and saves it to disk for persistence across restarts.
   */
  public async initializeSigner(): Promise<KeyPairSigner> {
    if (this.signer) {
      return this.signer;
    }

    // Safety: Refuse to initialize if trading mode is not 'live'
    if (this.config.TRADING_MODE !== 'live') {
      this.logger?.warn('MainnetWalletManager initialized in paper mode — wallet will be read-only');
    }

    // 1. Try loading from existing keypair file
    const keypairPath = this.config.MAINNET_KEYPAIR_PATH;
    if (keypairPath) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (fs.existsSync(keypairPath)) {
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          const raw = fs.readFileSync(keypairPath, 'utf-8');
          const bytes = new Uint8Array(JSON.parse(raw) as number[]);
          this.signer = await createKeyPairSignerFromBytes(bytes);
          this.logger?.info(
            { address: this.signer.address },
            '🔑 Loaded Mainnet hot wallet from keypair file'
          );
          return this.signer;
        }
      } catch (err: unknown) {
        this.logger?.warn({ err }, 'Failed to load MAINNET_KEYPAIR_PATH, generating fresh keypair');
      }
    }

    // 2. Generate fresh keypair and save to disk
    this.signer = await generateKeyPairSigner();
    const savePath = keypairPath || path.join(process.cwd(), 'mainnet-hot-wallet.json');

    // Export keypair bytes for persistence
    const keyPairBytes = new Uint8Array(64);
    const privateKeyBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', this.signer.keyPair.privateKey));
    const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', this.signer.keyPair.publicKey));
    // Standard Solana keypair format: 64 bytes = 32 private + 32 public
    keyPairBytes.set(privateKeyBytes.slice(-32), 0);
    keyPairBytes.set(publicKeyBytes, 32);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(savePath, JSON.stringify(Array.from(keyPairBytes)));

    this.logger?.info(
      { address: this.signer.address, savedTo: savePath },
      '🔑 Generated and saved fresh Mainnet hot wallet keypair'
    );

    return this.signer;
  }

  /**
   * Get current SOL balance from on-chain RPC
   */
  public async getBalance(rpc: Rpc<SolanaRpcApi>): Promise<MainnetWalletBalance> {
    const signer = this.getSigner();
    const result = await rpc.getBalance(signer.address).send();
    const lamports = result.value;
    const sol = Number(lamports) / 1_000_000_000;

    // Minimum SOL needed: ~0.01 SOL for gas + trade amount in SOL
    const minSolRequired = 0.02;
    const hasSufficientFunds = sol >= minSolRequired;

    this.logger?.debug(
      { address: signer.address, sol: sol.toFixed(6), hasSufficientFunds },
      'Mainnet wallet balance queried'
    );

    return {
      address: signer.address,
      lamports,
      sol: parseFloat(sol.toFixed(6)),
      hasSufficientFunds,
    };
  }

  /**
   * Validate that the wallet has enough SOL for at least one trade + gas
   */
  public async validateSufficientFunds(rpc: Rpc<SolanaRpcApi>, minSolRequired = 0.02): Promise<boolean> {
    const balance = await this.getBalance(rpc);
    if (!balance.hasSufficientFunds) {
      this.logger?.warn(
        {
          address: balance.address,
          currentSol: balance.sol,
          requiredSol: minSolRequired,
        },
        '⚠️ Insufficient mainnet wallet funds for trading'
      );
      return false;
    }
    return true;
  }

  public getSigner(): KeyPairSigner {
    if (!this.signer) {
      throw new Error('MainnetWalletManager not initialized. Call initializeSigner() first.');
    }
    return this.signer;
  }

  public getAddress(): Address {
    return this.getSigner().address;
  }

  public getColdStorageAddress(): Address | null {
    return (this.config.COLD_STORAGE_ADDRESS as Address) || null;
  }
}
