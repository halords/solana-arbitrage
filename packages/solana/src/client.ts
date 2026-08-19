import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  Rpc,
  SolanaRpcApi,
  RpcSubscriptions,
  SolanaRpcSubscriptionsApi,
} from '@solana/kit';
import { AppConfig } from '@solana-arbitrage/config';

export interface SolanaConnectionBundle {
  readonly rpc: Rpc<SolanaRpcApi>;
  readonly rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  readonly cluster: 'devnet' | 'mainnet-beta';
  readonly rpcUrl: string;
  readonly wsUrl: string;
}

export function createSolanaConnection(config: AppConfig): SolanaConnectionBundle {
  const rpc = createSolanaRpc(config.SOLANA_RPC_URL);
  const rpcSubscriptions = createSolanaRpcSubscriptions(config.SOLANA_WS_URL);

  return {
    rpc,
    rpcSubscriptions,
    cluster: config.SOLANA_CLUSTER,
    rpcUrl: config.SOLANA_RPC_URL,
    wsUrl: config.SOLANA_WS_URL,
  };
}
