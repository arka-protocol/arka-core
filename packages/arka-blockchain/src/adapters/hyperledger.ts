/**
 * Hyperledger Fabric Blockchain Adapter
 *
 * Adapter for anchoring ARKA Protocol records to Hyperledger Fabric.
 * Requires fabric-network package to be installed.
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

/**
 * Hyperledger Fabric specific configuration
 */
export interface FabricConfig extends BlockchainConfig {
  network: 'hyperledger-fabric';
  /** Connection profile path or object */
  connectionProfile: string | Record<string, unknown>;
  /** Channel name */
  channelName: string;
  /** Chaincode name for ARKA anchoring */
  contractName: string;
  /** MSP ID of the organization */
  mspId: string;
  /** Discovery options */
  discovery?: {
    enabled: boolean;
    asLocalhost: boolean;
  };
}

/**
 * Contract method names in the ARKA Chaincode
 */
const CHAINCODE_METHODS = {
  ANCHOR: 'anchorBatch',
  VERIFY: 'verifyMerkleRoot',
  QUERY: 'queryAnchors',
  GET_ANCHOR: 'getAnchor',
  GET_BLOCK_HEIGHT: 'getBlockHeight',
} as const;

/**
 * Hyperledger Fabric adapter for ARKA Protocol
 *
 * This adapter interfaces with Hyperledger Fabric to anchor
 * ARKA decision batches using Merkle roots.
 *
 * Prerequisites:
 * 1. Install fabric-network: npm install fabric-network
 * 2. Deploy the ARKA Chaincode to your Fabric network
 * 3. Configure connection profile and identity
 */
export class HyperledgerFabricAdapter extends BaseBlockchainAdapter {
  readonly id = 'hyperledger-fabric-adapter';
  readonly network = 'hyperledger-fabric' as const;

  private gateway: unknown = null;
  private fabricNetwork: unknown = null;
  private contract: unknown = null;
  private fabricConfig: FabricConfig | null = null;

  /**
   * Connect to Hyperledger Fabric network
   */
  async connect(config: BlockchainConfig): Promise<void> {
    this.fabricConfig = config as FabricConfig;

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
      // Load wallet
      const wallet = await this.loadWallet(Wallets as WalletsType);

      // Create gateway
      const GatewayClass = Gateway as GatewayConstructor;
      this.gateway = new GatewayClass();

      // Load connection profile
      const connectionProfile =
        typeof this.fabricConfig.connectionProfile === 'string'
          ? await this.loadConnectionProfile(this.fabricConfig.connectionProfile)
          : this.fabricConfig.connectionProfile;

      // Connect to gateway
      await (this.gateway as GatewayInstance).connect(connectionProfile, {
        wallet,
        identity: this.fabricConfig.identity?.userId ?? 'admin',
        discovery: this.fabricConfig.discovery ?? { enabled: true, asLocalhost: true },
      });

      // Get network (channel)
      this.fabricNetwork = await (this.gateway as GatewayInstance).getNetwork(
        this.fabricConfig.channelName
      );

      // Get contract
      this.contract = (this.fabricNetwork as NetworkInstance).getContract(
        this.fabricConfig.contractName
      );

      this.connected = true;
      this.config = config;

      await this.emitEvent({
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: { channel: this.fabricConfig.channelName },
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
   * Disconnect from Hyperledger Fabric
   */
  async disconnect(): Promise<void> {
    if (this.gateway) {
      (this.gateway as GatewayInstance).disconnect();
    }

    this.gateway = null;
    this.fabricNetwork = null;
    this.contract = null;
    this.connected = false;

    await this.emitEvent({
      type: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get health status
   */
  override async getHealth(): Promise<BlockchainHealth> {
    if (!this.connected || !this.contract) {
      return {
        connected: false,
        network: this.network,
        error: 'Not connected',
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
   * Anchor a batch to Hyperledger Fabric
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
      metadata: request.metadata ?? {},
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
          channel: this.fabricConfig?.channelName,
          chaincode: this.fabricConfig?.contractName,
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

      const response = JSON.parse(result.toString()) as AnchoredRecord[];
      return response;
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

    // In Fabric, transactions are confirmed when they're committed to the ledger
    // We can verify by checking if the anchor exists
    const startBlock = await this.getBlockNumber();
    const timeout = this.fabricConfig?.timeout ?? 30000;
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
   * Load wallet with identity
   */
  private async loadWallet(Wallets: WalletsType): Promise<unknown> {
    if (!this.fabricConfig?.identity?.walletPath) {
      // Create in-memory wallet with default identity
      return Wallets.newInMemoryWallet();
    }

    return Wallets.newFileSystemWallet(this.fabricConfig.identity.walletPath);
  }

  /**
   * Load connection profile from file
   */
  private async loadConnectionProfile(profilePath: string): Promise<Record<string, unknown>> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(profilePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  }
}

// Type definitions for fabric-network (to avoid requiring the package at compile time)
interface WalletsType {
  newInMemoryWallet(): Promise<unknown>;
  newFileSystemWallet(path: string): Promise<unknown>;
}

interface GatewayConstructor {
  new (): GatewayInstance;
}

interface GatewayInstance {
  connect(
    profile: Record<string, unknown>,
    options: Record<string, unknown>
  ): Promise<void>;
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
 * Example ARKA Chaincode (Go) for Hyperledger Fabric:
 *
 * ```go
 * package main
 *
 * import (
 *     "encoding/json"
 *     "fmt"
 *     "github.com/hyperledger/fabric-contract-api-go/contractapi"
 * )
 *
 * type ARKAChaincode struct {
 *     contractapi.Contract
 * }
 *
 * type AnchorRecord struct {
 *     AnchorID    string                 `json:"anchorId"`
 *     MerkleRoot  string                 `json:"merkleRoot"`
 *     RecordCount int                    `json:"recordCount"`
 *     BatchID     string                 `json:"batchId"`
 *     Timestamp   string                 `json:"timestamp"`
 *     TxID        string                 `json:"transactionId"`
 *     BlockNum    uint64                 `json:"blockNumber"`
 *     Metadata    map[string]interface{} `json:"metadata"`
 * }
 *
 * func (c *PACTChaincode) AnchorBatch(ctx contractapi.TransactionContextInterface, anchorJSON string) (*AnchorRecord, error) {
 *     var anchor AnchorRecord
 *     if err := json.Unmarshal([]byte(anchorJSON), &anchor); err != nil {
 *         return nil, fmt.Errorf("failed to unmarshal anchor: %v", err)
 *     }
 *
 *     anchor.TxID = ctx.GetStub().GetTxID()
 *
 *     // Store by anchor ID
 *     anchorBytes, _ := json.Marshal(anchor)
 *     if err := ctx.GetStub().PutState(anchor.AnchorID, anchorBytes); err != nil {
 *         return nil, err
 *     }
 *
 *     // Store merkle root index
 *     if err := ctx.GetStub().PutState("merkle:"+anchor.MerkleRoot, []byte(anchor.AnchorID)); err != nil {
 *         return nil, err
 *     }
 *
 *     return &anchor, nil
 * }
 *
 * func (c *PACTChaincode) VerifyMerkleRoot(ctx contractapi.TransactionContextInterface, merkleRoot string) (string, error) {
 *     anchorID, err := ctx.GetStub().GetState("merkle:" + merkleRoot)
 *     if err != nil {
 *         return "", err
 *     }
 *     if anchorID == nil {
 *         return `{"exists": false}`, nil
 *     }
 *
 *     anchorBytes, err := ctx.GetStub().GetState(string(anchorID))
 *     if err != nil {
 *         return "", err
 *     }
 *
 *     return fmt.Sprintf(`{"exists": true, "anchor": %s}`, string(anchorBytes)), nil
 * }
 *
 * func main() {
 *     chaincode, err := contractapi.NewChaincode(&PACTChaincode{})
 *     if err != nil {
 *         panic(err)
 *     }
 *     if err := chaincode.Start(); err != nil {
 *         panic(err)
 *     }
 * }
 * ```
 */
