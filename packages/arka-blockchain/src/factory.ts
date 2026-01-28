/**
 * Blockchain Adapter Factory
 *
 * Factory for creating blockchain adapters based on network type.
 * Supports all major blockchain ecosystems:
 * - Memory (testing)
 * - Hyperledger Fabric (enterprise)
 * - Ethereum/EVM (Ethereum, Polygon, etc.)
 * - Solana
 * - Cosmos SDK
 * - Polkadot/Substrate
 */

import type {
  BlockchainAdapter,
  BlockchainAdapterFactory,
  BlockchainConfig,
  BlockchainNetwork,
} from './types.js';
import { MemoryBlockchainAdapter } from './adapters/memory.js';
import {
  EVMBlockchainAdapter,
  createEthereumAdapter,
  createPolygonAdapter,
  createEVMAdapter,
  type EVMConfig,
} from './adapters/evm.js';
import {
  SolanaBlockchainAdapter,
  createSolanaAdapter,
  createSolanaDevnetAdapter,
  type SolanaConfig,
} from './adapters/solana.js';
import {
  CosmosBlockchainAdapter,
  createCosmosHubAdapter,
  createOsmosisAdapter,
  createCosmosAdapter,
  type CosmosConfig,
} from './adapters/cosmos.js';
import {
  PolkadotBlockchainAdapter,
  createPolkadotAdapter,
  createKusamaAdapter,
  createWestendAdapter,
  createSubstrateAdapter,
  type PolkadotConfig,
} from './adapters/polkadot.js';

/**
 * Extended network types for all supported chains
 */
export type ExtendedBlockchainNetwork =
  | BlockchainNetwork
  | 'ethereum-mainnet'
  | 'ethereum-goerli'
  | 'ethereum-sepolia'
  | 'polygon-mainnet'
  | 'polygon-mumbai'
  | 'solana-mainnet'
  | 'solana-devnet'
  | 'cosmos-hub'
  | 'osmosis'
  | 'polkadot-mainnet'
  | 'kusama'
  | 'westend'
  | 'amazon-managed-blockchain';

/**
 * Registry of adapter constructors
 */
type AdapterConstructor = new () => BlockchainAdapter;

/**
 * AMB (Amazon Managed Blockchain) configuration
 */
export interface AMBConfig {
  /** AWS region */
  region: string;
  /** AMB Network ID */
  networkId: string;
  /** AMB Member ID */
  memberId: string;
  /** AMB Node ID(s) */
  nodeIds: string[];
  /** Channel name */
  channelName?: string;
  /** Chaincode name */
  contractName?: string;
  /** MSP ID */
  mspId?: string;
  /** Use VPC endpoint */
  useVpcEndpoint?: boolean;
}

/**
 * Factory configuration for custom adapters
 */
export interface AdapterFactoryConfig {
  /** EVM configuration */
  evm?: EVMConfig;
  /** Solana configuration */
  solana?: SolanaConfig;
  /** Cosmos configuration */
  cosmos?: CosmosConfig;
  /** Polkadot configuration */
  polkadot?: PolkadotConfig;
  /** Amazon Managed Blockchain configuration */
  amb?: AMBConfig;
}

/**
 * Default factory implementation
 */
export class DefaultBlockchainAdapterFactory implements BlockchainAdapterFactory {
  private adapters: Map<BlockchainNetwork, AdapterConstructor> = new Map();
  private configuredAdapters: Map<string, BlockchainAdapter> = new Map();

  constructor() {
    // Register built-in adapters
    this.registerAdapter('memory', MemoryBlockchainAdapter);
  }

  /**
   * Register a custom adapter
   */
  registerAdapter(network: BlockchainNetwork, adapter: AdapterConstructor): void {
    this.adapters.set(network, adapter);
  }

  /**
   * Create an adapter for the specified network
   */
  create(network: BlockchainNetwork, config?: Partial<BlockchainConfig>): BlockchainAdapter {
    // Check for pre-configured adapter
    const cached = this.configuredAdapters.get(network);
    if (cached) {
      return cached;
    }

    const AdapterClass = this.adapters.get(network);

    if (!AdapterClass) {
      throw new Error(`No adapter registered for network: ${network}`);
    }

    return new AdapterClass();
  }

  /**
   * Create and cache a configured adapter
   */
  createConfigured(
    network: ExtendedBlockchainNetwork,
    factoryConfig: AdapterFactoryConfig
  ): BlockchainAdapter {
    // Check cache first
    const cached = this.configuredAdapters.get(network);
    if (cached) {
      return cached;
    }

    let adapter: BlockchainAdapter;

    switch (network) {
      // Memory adapter
      case 'memory':
        adapter = new MemoryBlockchainAdapter();
        break;

      // EVM adapters
      case 'ethereum':
      case 'ethereum-mainnet':
        if (!factoryConfig.evm) {
          throw new Error('EVM configuration required for Ethereum');
        }
        adapter = createEthereumAdapter(factoryConfig.evm);
        break;

      case 'ethereum-goerli':
      case 'ethereum-sepolia':
        if (!factoryConfig.evm) {
          throw new Error('EVM configuration required for Ethereum testnet');
        }
        adapter = createEVMAdapter(`${network}-adapter`, 'ethereum', {
          ...factoryConfig.evm,
          chainId: network === 'ethereum-goerli' ? 5 : 11155111,
        });
        break;

      case 'polygon':
      case 'polygon-mainnet':
        if (!factoryConfig.evm) {
          throw new Error('EVM configuration required for Polygon');
        }
        adapter = createPolygonAdapter(factoryConfig.evm);
        break;

      case 'polygon-mumbai':
        if (!factoryConfig.evm) {
          throw new Error('EVM configuration required for Polygon Mumbai');
        }
        adapter = createEVMAdapter('polygon-mumbai-adapter', 'polygon', {
          ...factoryConfig.evm,
          chainId: 80001,
        });
        break;

      // Solana adapters
      case 'solana':
      case 'solana-mainnet':
        if (!factoryConfig.solana) {
          throw new Error('Solana configuration required');
        }
        adapter = createSolanaAdapter(factoryConfig.solana);
        break;

      case 'solana-devnet':
        adapter = createSolanaDevnetAdapter(factoryConfig.solana);
        break;

      // Cosmos adapters
      case 'cosmos-hub':
        adapter = createCosmosHubAdapter(factoryConfig.cosmos);
        break;

      case 'osmosis':
        adapter = createOsmosisAdapter(factoryConfig.cosmos);
        break;

      // Polkadot adapters
      case 'polkadot-mainnet':
        adapter = createPolkadotAdapter(factoryConfig.polkadot);
        break;

      case 'kusama':
        adapter = createKusamaAdapter(factoryConfig.polkadot);
        break;

      case 'westend':
        adapter = createWestendAdapter(factoryConfig.polkadot);
        break;

      // Amazon Managed Blockchain - use createAMBAdapter() async function instead
      case 'amazon-managed-blockchain':
        throw new Error(
          'Amazon Managed Blockchain requires async initialization. Use createAMBAdapter() instead.'
        );

      // Custom network - try basic adapters
      case 'custom':
        if (factoryConfig.evm) {
          adapter = createEVMAdapter('custom-evm', 'custom', factoryConfig.evm);
        } else if (factoryConfig.solana) {
          adapter = createSolanaAdapter(factoryConfig.solana);
        } else if (factoryConfig.cosmos) {
          adapter = createCosmosAdapter(factoryConfig.cosmos);
        } else if (factoryConfig.polkadot) {
          adapter = createSubstrateAdapter(factoryConfig.polkadot);
        } else if (factoryConfig.amb) {
          throw new Error(
            'Amazon Managed Blockchain requires async initialization. Use createAMBAdapter() instead.'
          );
        } else {
          throw new Error('Custom network requires configuration');
        }
        break;

      default:
        throw new Error(`Unsupported network: ${network}`);
    }

    // Cache the adapter
    this.configuredAdapters.set(network, adapter);
    return adapter;
  }

  /**
   * Check if network is supported
   */
  supports(network: BlockchainNetwork): boolean {
    return this.adapters.has(network) || this.isExtendedNetwork(network);
  }

  /**
   * Get list of supported networks
   */
  getSupportedNetworks(): BlockchainNetwork[] {
    const basic = Array.from(this.adapters.keys());
    const extended: BlockchainNetwork[] = [
      'ethereum',
      'polygon',
      'solana',
    ];
    return [...new Set([...basic, ...extended])];
  }

  /**
   * Get list of all extended networks
   */
  getAllSupportedNetworks(): ExtendedBlockchainNetwork[] {
    return [
      'memory',
      'hyperledger-fabric',
      'ethereum',
      'ethereum-mainnet',
      'ethereum-goerli',
      'ethereum-sepolia',
      'polygon',
      'polygon-mainnet',
      'polygon-mumbai',
      'solana',
      'solana-mainnet',
      'solana-devnet',
      'cosmos-hub',
      'osmosis',
      'polkadot-mainnet',
      'kusama',
      'westend',
      'amazon-managed-blockchain',
      'custom',
    ];
  }

  /**
   * Clear cached adapters
   */
  clearCache(): void {
    this.configuredAdapters.clear();
  }

  private isExtendedNetwork(network: string): boolean {
    const extendedNetworks = [
      'ethereum-mainnet',
      'ethereum-goerli',
      'ethereum-sepolia',
      'polygon-mainnet',
      'polygon-mumbai',
      'solana-mainnet',
      'solana-devnet',
      'cosmos-hub',
      'osmosis',
      'polkadot-mainnet',
      'kusama',
      'westend',
      'amazon-managed-blockchain',
    ];
    return extendedNetworks.includes(network);
  }
}

// Singleton factory instance
let factoryInstance: DefaultBlockchainAdapterFactory | null = null;

/**
 * Get the global adapter factory
 */
export function getAdapterFactory(): DefaultBlockchainAdapterFactory {
  if (!factoryInstance) {
    factoryInstance = new DefaultBlockchainAdapterFactory();
  }
  return factoryInstance;
}

/**
 * Reset the factory (for testing)
 */
export function resetAdapterFactory(): void {
  factoryInstance = null;
}

/**
 * Create an adapter for the specified network
 */
export function createAdapter(
  network: BlockchainNetwork,
  config?: Partial<BlockchainConfig>
): BlockchainAdapter {
  return getAdapterFactory().create(network, config);
}

/**
 * Create a configured adapter for extended networks
 */
export function createConfiguredAdapter(
  network: ExtendedBlockchainNetwork,
  factoryConfig: AdapterFactoryConfig
): BlockchainAdapter {
  return getAdapterFactory().createConfigured(network, factoryConfig);
}

/**
 * Register a custom adapter globally
 */
export function registerAdapter(network: BlockchainNetwork, adapter: AdapterConstructor): void {
  getAdapterFactory().registerAdapter(network, adapter);
}

/**
 * Async function to register Hyperledger adapter
 * (only loads if fabric-network is available)
 */
export async function registerHyperledgerAdapter(): Promise<boolean> {
  try {
    const { HyperledgerFabricAdapter } = await import('./adapters/hyperledger.js');
    registerAdapter('hyperledger-fabric', HyperledgerFabricAdapter);
    return true;
  } catch {
    console.warn('fabric-network not available, Hyperledger adapter not registered');
    return false;
  }
}

/**
 * Async function to register Amazon Managed Blockchain adapter
 * (only loads if @aws-sdk/client-managedblockchain is available)
 */
export async function registerAMBAdapter(): Promise<boolean> {
  try {
    const { AmazonManagedBlockchainAdapter } = await import('./managed-blockchain/index.js');
    registerAdapter('hyperledger-fabric', AmazonManagedBlockchainAdapter);
    return true;
  } catch {
    console.warn('@aws-sdk/client-managedblockchain not available, AMB adapter not registered');
    return false;
  }
}

/**
 * Create an AMB adapter for Amazon Managed Blockchain
 */
export async function createAMBAdapter(config: AMBConfig): Promise<BlockchainAdapter> {
  const { createAMBAdapterForRegion } = await import('./managed-blockchain/index.js');
  return createAMBAdapterForRegion(
    config.region,
    config.networkId,
    config.memberId,
    config.nodeIds
  );
}

// Re-export adapter types and factories for convenience
export {
  EVMBlockchainAdapter,
  createEthereumAdapter,
  createPolygonAdapter,
  createEVMAdapter,
  type EVMConfig,
} from './adapters/evm.js';

export {
  SolanaBlockchainAdapter,
  createSolanaAdapter,
  createSolanaDevnetAdapter,
  type SolanaConfig,
} from './adapters/solana.js';

export {
  CosmosBlockchainAdapter,
  createCosmosHubAdapter,
  createOsmosisAdapter,
  createCosmosAdapter,
  type CosmosConfig,
} from './adapters/cosmos.js';

export {
  PolkadotBlockchainAdapter,
  createPolkadotAdapter,
  createKusamaAdapter,
  createWestendAdapter,
  createSubstrateAdapter,
  type PolkadotConfig,
} from './adapters/polkadot.js';
