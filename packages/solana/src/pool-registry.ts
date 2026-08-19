import { Address, Rpc, SolanaRpcApi } from '@solana/kit';
import { Logger } from 'pino';

export interface MainnetPoolInfo {
  readonly poolAddress: Address;
  readonly dexId: 'raydium' | 'orca';
  readonly programId: Address;
  readonly tokenAMint: Address;
  readonly tokenBMint: Address;
  readonly tokenASymbol: string;
  readonly tokenBSymbol: string;
  readonly pairLabel: string;
}

// Verified mainnet pool addresses (SOL/USDC pairs)
const MAINNET_POOLS: MainnetPoolInfo[] = [
  {
    poolAddress: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' as Address,
    dexId: 'raydium',
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' as Address,
    tokenAMint: 'So11111111111111111111111111111111111111112' as Address,
    tokenBMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address,
    tokenASymbol: 'SOL',
    tokenBSymbol: 'USDC',
    pairLabel: 'SOL/USDC',
  },
  {
    poolAddress: 'HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ' as Address,
    dexId: 'orca',
    programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc' as Address,
    tokenAMint: 'So11111111111111111111111111111111111111112' as Address,
    tokenBMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address,
    tokenASymbol: 'SOL',
    tokenBSymbol: 'USDC',
    pairLabel: 'SOL/USDC',
  },
];

export class MainnetPoolRegistry {
  private readonly logger: Logger | undefined;
  private readonly pools: MainnetPoolInfo[];

  constructor(logger?: Logger) {
    this.logger = logger;
    this.pools = [...MAINNET_POOLS];
  }

  /**
   * Get all registered mainnet pools
   */
  public getAllPools(): MainnetPoolInfo[] {
    return this.pools;
  }

  /**
   * Get pools for a specific DEX
   */
  public getPoolsByDex(dexId: 'raydium' | 'orca'): MainnetPoolInfo[] {
    return this.pools.filter((p) => p.dexId === dexId);
  }

  /**
   * Get pools for a specific trading pair
   */
  public getPoolsByPair(tokenASymbol: string, tokenBSymbol: string): MainnetPoolInfo[] {
    return this.pools.filter(
      (p) =>
        (p.tokenASymbol === tokenASymbol && p.tokenBSymbol === tokenBSymbol) ||
        (p.tokenASymbol === tokenBSymbol && p.tokenBSymbol === tokenASymbol)
    );
  }

  /**
   * Verify that a pool account exists on-chain
   */
  public async verifyPoolExists(rpc: Rpc<SolanaRpcApi>, poolAddress: Address): Promise<boolean> {
    try {
      const accountInfo = await rpc.getAccountInfo(poolAddress, { encoding: 'base64' }).send();
      const exists = accountInfo.value !== null;
      this.logger?.debug({ poolAddress, exists }, 'Pool account existence check');
      return exists;
    } catch (err: unknown) {
      this.logger?.warn({ poolAddress, err }, 'Failed to verify pool existence');
      return false;
    }
  }

  /**
   * Fetch raw pool account data for on-chain price calculation
   */
  public async fetchPoolAccountData(
    rpc: Rpc<SolanaRpcApi>,
    poolAddress: Address
  ): Promise<Uint8Array | null> {
    try {
      const accountInfo = await rpc.getAccountInfo(poolAddress, { encoding: 'base64' }).send();
      if (!accountInfo.value || !accountInfo.value.data) {
        return null;
      }
      // accountInfo.value.data is [base64string, encoding] when encoding is base64
      const data = accountInfo.value.data;
      if (Array.isArray(data)) {
        return new Uint8Array(Buffer.from(data[0] as string, 'base64'));
      }
      return null;
    } catch (err: unknown) {
      this.logger?.warn({ poolAddress, err }, 'Failed to fetch pool account data');
      return null;
    }
  }
}
