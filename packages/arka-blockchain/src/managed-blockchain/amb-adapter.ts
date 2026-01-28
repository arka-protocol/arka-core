/**
 * Amazon Managed Blockchain Adapter
 *
 * Blockchain adapter for ARKA Protocol that connects to
 * Amazon Managed Blockchain (AMB) Hyperledger Fabric networks.
 *
 * Features:
 * - Connects to AMB-hosted Fabric networks
 * - Supports VPC endpoint for private access
 * - Integrates with AMB identity management
 * - Automatic credential refresh via AWS SDK
 */

import { BaseBlockchainAdapter } from '../base-adapter.js';
import type {
  BlockchainConfig,
  AnchorRequest,
  AnchoredRecord,
  AnchorQuery,
  VerificationResult,
  BlockchainHealth,
} from '../types.js';
import type { AMBBlockchainConfig, AMBHealthCheck } from './types.js';

/**
 * Chaincode methods for ARKA anchoring
 */
const CHAINCODE_METHODS = {
  ANCHOR: 'anchorBatch',
  VERIFY: 'verifyMerkleRoot',
  QUERY: 'queryAnchors',
  GET_ANCHOR: 'getAnchor',
  GET_BLOCK_HEIGHT: 'getBlockHeight',
} as const;

/**
 * Amazon Managed Blockchain Adapter
 *
 * Connects to Hyperledger Fabric networks managed by AWS AMB.
 *
 * Prerequisites:
 * 1. Create AMB network and member via AWS Console or AMBNetworkManager
 * 2. Deploy the ARKA Chaincode to the network
 * 3. Configure IAM permissions for AMB access
 * 4. Set up VPC endpoint if using private access
 */
export class AmazonManagedBlockchainAdapter extends BaseBlockchainAdapter {
  readonly id = 'amazon-managed-blockchain-adapter';
  readonly network = 'hyperledger-fabric' as const;

  private ambConfig: AMBBlockchainConfig | null = null;
  private gateway: unknown = null;
  private fabricNetwork: unknown = null;
  private contract: unknown = null;
  private wallet: unknown = null;

  /**
   * Connect to Amazon Managed Blockchain network
   */
  async connect(config: BlockchainConfig): Promise<void> {
    this.ambConfig = config as AMBBlockchainConfig;

    // Validate required AMB configuration
    this.validateConfig(this.ambConfig);

    // Dynamically import fabric-network
    let Gateway: unknown;
    let Wallets: unknown;

    try {
      const fabricModule = await import('fabric-network');
      Gateway = fabricModule.Gateway;
      Wallets = fabricModule.Wallets;
    } catch {
      throw new Error(
        'fabric-network package not found. Install it with: npm install fabric-network'
      );
    }

    try {
      // Create wallet with AMB credentials
      this.wallet = await this.createAMBWallet(Wallets as WalletsType);

      // Build connection profile for AMB
      const connectionProfile = await this.buildConnectionProfile();

      // Create and connect gateway
      const GatewayClass = Gateway as GatewayConstructor;
      this.gateway = new GatewayClass();

      await (this.gateway as GatewayInstance).connect(connectionProfile, {
        wallet: this.wallet,
        identity: this.ambConfig.identity?.userId ?? 'admin',
        discovery: {
          enabled: true,
          asLocalhost: false, // AMB is never localhost
        },
      });

      // Get network (channel)
      const channelName = this.ambConfig.channelName ?? 'arka-channel';
      this.fabricNetwork = await (this.gateway as GatewayInstance).getNetwork(channelName);

      // Get contract
      const contractName = this.ambConfig.contractName ?? 'arka-chaincode';
      this.contract = (this.fabricNetwork as NetworkInstance).getContract(contractName);

      this.connected = true;
      this.config = config;

      await this.emitEvent({
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: {
          networkId: this.ambConfig.networkId,
          memberId: this.ambConfig.memberId,
          channel: channelName,
        },
      });
    } catch (error) {
      await this.emitEvent({
        type: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Disconnect from Amazon Managed Blockchain
   */
  async disconnect(): Promise<void> {
    if (this.gateway) {
      (this.gateway as GatewayInstance).disconnect();
    }

    this.gateway = null;
    this.fabricNetwork = null;
    this.contract = null;
    this.wallet = null;
    this.connected = false;

    await this.emitEvent({
      type: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get health status including AMB-specific info
   */
  override async getHealth(): Promise<BlockchainHealth> {
    if (!this.connected || !this.contract) {
      return {
        connected: false,
        network: this.network,
        error: 'Not connected to Amazon Managed Blockchain',
      };
    }

    try {
      const blockHeight = await this.getBlockNumber();
      return {
        connected: true,
        network: this.network,
        blockHeight,
        lastActivity: this.lastActivity ?? undefined,
      };
    } catch (error) {
      return {
        connected: false,
        network: this.network,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get detailed AMB health check
   */
  async getAMBHealth(): Promise<AMBHealthCheck> {
    if (!this.ambConfig) {
      return {
        network: { id: '', status: 'DELETED', healthy: false },
        nodes: [],
        overall: false,
        timestamp: new Date().toISOString(),
      };
    }

    // This would typically call AMBClient to get actual status
    // For now, we check connection status
    const isHealthy = this.connected;

    return {
      network: {
        id: this.ambConfig.networkId,
        status: isHealthy ? 'AVAILABLE' : 'CREATE_FAILED',
        healthy: isHealthy,
      },
      member: {
        id: this.ambConfig.memberId,
        status: isHealthy ? 'AVAILABLE' : 'INACCESSIBLE_ENCRYPTION_KEY',
        healthy: isHealthy,
      },
      nodes: this.ambConfig.nodeIds.map((nodeId) => ({
        id: nodeId,
        status: isHealthy ? 'AVAILABLE' : 'UNHEALTHY',
        healthy: isHealthy,
      })),
      overall: isHealthy,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Anchor a batch to Amazon Managed Blockchain
   */
  async anchor(request: AnchorRequest): Promise<AnchoredRecord> {
    this.ensureConnected();

    const anchorId = this.generateAnchorId();
    const timestamp = new Date().toISOString();

    const anchorData = {
      anchorId,
      merkleRoot: request.merkleRoot,
      recordCount: request.recordCount,
      batchId: request.batchId,
      timestamp,
      metadata: {
        ...request.metadata,
        ambNetworkId: this.ambConfig?.networkId,
        ambMemberId: this.ambConfig?.memberId,
      },
    };

    try {
      // Submit transaction to chaincode
      const result = await (this.contract as ContractInstance).submitTransaction(
        CHAINCODE_METHODS.ANCHOR,
        JSON.stringify(anchorData)
      );

      const response = JSON.parse(result.toString()) as FabricAnchorResponse;

      const anchor: AnchoredRecord = {
        anchorId,
        transactionHash: response.transactionId,
        blockNumber: response.blockNumber,
        blockHash: response.blockHash,
        merkleRoot: request.merkleRoot,
        recordCount: request.recordCount,
        timestamp,
        network: this.network,
        metadata: {
          ...request.metadata,
          channel: this.ambConfig?.channelName,
          chaincode: this.ambConfig?.contractName,
          ambNetworkId: this.ambConfig?.networkId,
          ambMemberId: this.ambConfig?.memberId,
        },
      };

      await this.emitEvent({
        type: 'anchored',
        timestamp,
        data: anchor,
      });

      return anchor;
    } catch (error) {
      await this.emitEvent({
        type: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Verify a merkle root exists on chain
   */
  async verify(merkleRoot: string): Promise<VerificationResult> {
    this.ensureConnected();

    try {
      const result = await (this.contract as ContractInstance).evaluateTransaction(
        CHAINCODE_METHODS.VERIFY,
        merkleRoot
      );

      const response = JSON.parse(result.toString()) as FabricVerifyResponse;

      if (!response.exists) {
        return {
          verified: false,
          error: 'Merkle root not found on chain',
        };
      }

      await this.emitEvent({
        type: 'verified',
        timestamp: new Date().toISOString(),
        data: { merkleRoot, verified: true },
      });

      return {
        verified: true,
        anchor: response.anchor,
      };
    } catch (error) {
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Query anchored records
   */
  async query(query: AnchorQuery): Promise<AnchoredRecord[]> {
    this.ensureConnected();

    try {
      const result = await (this.contract as ContractInstance).evaluateTransaction(
        CHAINCODE_METHODS.QUERY,
        JSON.stringify(query)
      );

      return JSON.parse(result.toString()) as AnchoredRecord[];
    } catch (error) {
      console.error('Query failed:', error);
      return [];
    }
  }

  /**
   * Get anchor by ID
   */
  async getAnchor(anchorId: string): Promise<AnchoredRecord | null> {
    this.ensureConnected();

    try {
      const result = await (this.contract as ContractInstance).evaluateTransaction(
        CHAINCODE_METHODS.GET_ANCHOR,
        anchorId
      );

      if (!result || result.length === 0) {
        return null;
      }

      return JSON.parse(result.toString()) as AnchoredRecord;
    } catch {
      return null;
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    this.ensureConnected();

    try {
      const result = await (this.contract as ContractInstance).evaluateTransaction(
        CHAINCODE_METHODS.GET_BLOCK_HEIGHT
      );

      return parseInt(result.toString(), 10);
    } catch (error) {
      throw new Error(
        `Failed to get block height: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(transactionHash: string, confirmations: number = 1): Promise<boolean> {
    this.ensureConnected();

    const startBlock = await this.getBlockNumber();
    const timeout = this.ambConfig?.timeout ?? 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentBlock = await this.getBlockNumber();
      if (currentBlock >= startBlock + confirmations) {
        // Verify the transaction was included
        const anchors = await this.query({ transactionHash });
        if (anchors.length > 0) {
          return true;
        }
      }
      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }

  /**
   * Validate AMB configuration
   */
  private validateConfig(config: AMBBlockchainConfig): void {
    if (!config.region) {
      throw new Error('AMB configuration requires region');
    }
    if (!config.networkId) {
      throw new Error('AMB configuration requires networkId');
    }
    if (!config.memberId) {
      throw new Error('AMB configuration requires memberId');
    }
    if (!config.nodeIds || config.nodeIds.length === 0) {
      throw new Error('AMB configuration requires at least one nodeId');
    }
  }

  /**
   * Create wallet with AMB credentials
   */
  private async createAMBWallet(Wallets: WalletsType): Promise<unknown> {
    // For AMB, we typically use a file system wallet with certificates
    // generated from the AMB Certificate Authority
    if (this.ambConfig?.identity?.walletPath) {
      return Wallets.newFileSystemWallet(this.ambConfig.identity.walletPath);
    }

    // Fall back to in-memory wallet (requires identity to be registered separately)
    return Wallets.newInMemoryWallet();
  }

  /**
   * Build connection profile for AMB
   */
  private async buildConnectionProfile(): Promise<Record<string, unknown>> {
    if (!this.ambConfig) {
      throw new Error('AMB configuration not set');
    }

    const { region, networkId, memberId, fabricSettings } = this.ambConfig;

    // Build endpoint URLs
    const ordererEndpoint =
      fabricSettings?.ordererEndpoint ??
      `grpcs://orderer.${networkId}.managedblockchain.${region}.amazonaws.com:30001`;

    const peerEndpoints = fabricSettings?.peerEndpoints ?? [
      `grpcs://peer.node.${memberId}.${networkId}.managedblockchain.${region}.amazonaws.com:30003`,
    ];

    const caEndpoint =
      fabricSettings?.caEndpoint ??
      `https://ca.${memberId}.${networkId}.managedblockchain.${region}.amazonaws.com:30002`;

    // Connection profile for AMB Fabric network
    const connectionProfile: Record<string, unknown> = {
      name: `arka-amb-${networkId}`,
      version: '1.0.0',
      client: {
        organization: memberId,
        connection: {
          timeout: {
            peer: {
              endorser: '300',
              eventHub: '600',
              eventReg: '300',
            },
            orderer: '300',
          },
        },
      },
      organizations: {
        [memberId]: {
          mspid: this.ambConfig.mspId ?? `${memberId}MSP`,
          peers: peerEndpoints.map((_, idx) => `peer${idx}.${memberId}`),
          certificateAuthorities: [`ca.${memberId}`],
        },
      },
      peers: peerEndpoints.reduce(
        (acc, endpoint, idx) => {
          acc[`peer${idx}.${memberId}`] = {
            url: endpoint,
            tlsCACerts: {
              pem: this.getTLSCACert(),
            },
            grpcOptions: {
              'ssl-target-name-override': `peer.node.${memberId}.${networkId}.managedblockchain.${region}.amazonaws.com`,
            },
          };
          return acc;
        },
        {} as Record<string, unknown>
      ),
      certificateAuthorities: {
        [`ca.${memberId}`]: {
          url: caEndpoint,
          caName: `${memberId}CA`,
          tlsCACerts: {
            pem: this.getTLSCACert(),
          },
          httpOptions: {
            verify: true,
          },
        },
      },
      orderers: {
        [`orderer.${networkId}`]: {
          url: ordererEndpoint,
          tlsCACerts: {
            pem: this.getTLSCACert(),
          },
          grpcOptions: {
            'ssl-target-name-override': `orderer.${networkId}.managedblockchain.${region}.amazonaws.com`,
          },
        },
      },
      channels: {
        [this.ambConfig.channelName ?? 'arka-channel']: {
          orderers: [`orderer.${networkId}`],
          peers: peerEndpoints.reduce(
            (acc, _, idx) => {
              acc[`peer${idx}.${memberId}`] = {
                endorsingPeer: true,
                chaincodeQuery: true,
                ledgerQuery: true,
                eventSource: true,
              };
              return acc;
            },
            {} as Record<string, unknown>
          ),
        },
      },
    };

    return connectionProfile;
  }

  /**
   * Get TLS CA certificate for AMB
   * In production, this should be loaded from a secure location
   */
  private getTLSCACert(): string {
    // AMB provides the TLS CA cert through the AWS Console or API
    // This is a placeholder - in production, load from secure storage
    // or environment variable
    return process.env.AMB_TLS_CA_CERT ?? '';
  }

  /**
   * Get AMB configuration (for external access)
   */
  getAMBConfig(): AMBBlockchainConfig | null {
    return this.ambConfig;
  }
}

// Type definitions for fabric-network
interface WalletsType {
  newInMemoryWallet(): Promise<unknown>;
  newFileSystemWallet(path: string): Promise<unknown>;
}

interface GatewayConstructor {
  new (): GatewayInstance;
}

interface GatewayInstance {
  connect(profile: Record<string, unknown>, options: Record<string, unknown>): Promise<void>;
  getNetwork(channelName: string): Promise<NetworkInstance>;
  disconnect(): void;
}

interface NetworkInstance {
  getContract(contractName: string): ContractInstance;
}

interface ContractInstance {
  submitTransaction(name: string, ...args: string[]): Promise<Buffer>;
  evaluateTransaction(name: string, ...args: string[]): Promise<Buffer>;
}

interface FabricAnchorResponse {
  transactionId: string;
  blockNumber: number;
  blockHash: string;
}

interface FabricVerifyResponse {
  exists: boolean;
  anchor?: AnchoredRecord;
}

/**
 * Create a configured AMB adapter
 */
export function createAMBAdapter(config: Partial<AMBBlockchainConfig>): AmazonManagedBlockchainAdapter {
  const adapter = new AmazonManagedBlockchainAdapter();

  // Pre-configure if full config is provided
  if (config.region && config.networkId && config.memberId && config.nodeIds) {
    // Config will be applied on connect()
  }

  return adapter;
}

/**
 * Create AMB adapter for a specific region
 */
export function createAMBAdapterForRegion(
  region: string,
  networkId: string,
  memberId: string,
  nodeIds: string[]
): AmazonManagedBlockchainAdapter {
  return createAMBAdapter({
    network: 'hyperledger-fabric',
    region,
    networkId,
    memberId,
    nodeIds,
    endpoints: [], // Will be built from AMB config
  });
}
