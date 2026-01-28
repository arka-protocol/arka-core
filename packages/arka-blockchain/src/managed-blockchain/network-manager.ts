/**
 * Amazon Managed Blockchain Network Manager
 *
 * High-level service for managing AMB private blockchain networks
 * for ARKA Protocol clients. Provides simplified APIs for:
 *
 * - Creating and configuring private networks
 * - Managing network members and nodes
 * - Deploying ARKA chaincode
 * - Monitoring network health
 * - Handling network lifecycle events
 */

import { AMBClient, createAMBClient } from './amb-client.js';
import type {
  AMBNetwork,
  AMBMember,
  AMBNode,
  AMBProposal,
  AMBInvitation,
  AMBHealthCheck,
  AMBOperationResult,
  AMBEvent,
  AMBEventHandler,
  AMBInstanceType,
  FabricEdition,
  FabricVersion,
  CreateNetworkConfig,
  CreateNodeConfig,
} from './types.js';

/**
 * Network configuration for client deployments
 */
export interface ClientNetworkConfig {
  /** Client/organization name */
  clientName: string;
  /** Network name */
  networkName: string;
  /** Network description */
  description?: string;
  /** AWS region */
  region: string;
  /** Fabric edition (STARTER for dev, STANDARD for prod) */
  edition: FabricEdition;
  /** Fabric version */
  version: FabricVersion;
  /** Admin credentials */
  adminCredentials: {
    username: string;
    password: string;
  };
  /** Node configuration */
  nodeConfig?: {
    instanceType?: AMBInstanceType;
    availabilityZone?: string;
    stateDB?: 'LevelDB' | 'CouchDB';
  };
  /** Enable CloudWatch logging */
  enableLogging?: boolean;
  /** KMS key ARN for encryption */
  kmsKeyArn?: string;
  /** Tags for resources */
  tags?: Record<string, string>;
}

/**
 * Network deployment result
 */
export interface NetworkDeploymentResult {
  /** Network ID */
  networkId: string;
  /** Member ID */
  memberId: string;
  /** Node ID */
  nodeId?: string;
  /** Network details */
  network?: AMBNetwork;
  /** Member details */
  member?: AMBMember;
  /** Node details */
  node?: AMBNode;
  /** Connection endpoints */
  endpoints?: {
    orderer?: string;
    peer?: string;
    ca?: string;
  };
}

/**
 * Network status summary
 */
export interface NetworkStatus {
  /** Network ID */
  networkId: string;
  /** Network name */
  networkName: string;
  /** Overall status */
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'CREATING' | 'UNKNOWN';
  /** Network details */
  network: AMBNetwork | null;
  /** Members */
  members: AMBMember[];
  /** Nodes */
  nodes: AMBNode[];
  /** Health check result */
  health: AMBHealthCheck | null;
  /** Last updated */
  lastUpdated: string;
}

/**
 * Amazon Managed Blockchain Network Manager
 *
 * Manages the lifecycle of private blockchain networks for ARKA clients.
 */
export class AMBNetworkManager {
  private clients: Map<string, AMBClient> = new Map();
  private eventHandlers: Set<AMBEventHandler> = new Set();
  private networkCache: Map<string, NetworkStatus> = new Map();

  /**
   * Get or create AMB client for a region
   */
  private async getClient(region: string): Promise<AMBClient> {
    let client = this.clients.get(region);
    if (!client) {
      client = createAMBClient(region);
      await client.initialize();
      this.clients.set(region, client);

      // Forward events from client
      client.subscribe((event) => this.emitEvent(event));
    }
    return client;
  }

  /**
   * Create a new private blockchain network for a client
   *
   * This creates a complete network setup including:
   * - Network with voting policy
   * - Initial member
   * - Peer node
   */
  async createClientNetwork(config: ClientNetworkConfig): Promise<AMBOperationResult<NetworkDeploymentResult>> {
    const client = await this.getClient(config.region);

    // Step 1: Create network with initial member
    const networkConfig: CreateNetworkConfig = {
      name: config.networkName,
      description: config.description ?? `ARKA Protocol network for ${config.clientName}`,
      framework: 'HYPERLEDGER_FABRIC',
      frameworkVersion: config.version,
      frameworkConfiguration: {
        fabric: {
          edition: config.edition,
        },
      },
      votingPolicy: {
        approvalThresholdPolicy: {
          thresholdPercentage: 50,
          proposalDurationInHours: 24,
          thresholdComparator: 'GREATER_THAN',
        },
      },
      memberConfiguration: {
        name: config.clientName,
        description: `${config.clientName} member`,
        frameworkConfiguration: {
          fabric: {
            adminUsername: config.adminCredentials.username,
            adminPassword: config.adminCredentials.password,
          },
        },
        logPublishingConfiguration: config.enableLogging
          ? {
              fabric: {
                caLogs: {
                  enabled: true,
                },
              },
            }
          : undefined,
        kmsKeyArn: config.kmsKeyArn,
        tags: {
          ...config.tags,
          'pact:client': config.clientName,
          'pact:managed': 'true',
        },
      },
      tags: {
        ...config.tags,
        'pact:client': config.clientName,
        'pact:managed': 'true',
      },
    };

    const networkResult = await client.createNetwork(networkConfig);

    if (!networkResult.success || !networkResult.data) {
      return {
        success: false,
        error: networkResult.error ?? { code: 'CREATE_FAILED', message: 'Failed to create network' },
      };
    }

    const { networkId, memberId } = networkResult.data;

    // Wait for network to become available
    const networkReady = await this.waitForNetworkStatus(
      config.region,
      networkId,
      'AVAILABLE',
      600000 // 10 minutes
    );

    if (!networkReady) {
      return {
        success: false,
        error: { code: 'TIMEOUT', message: 'Network creation timed out' },
      };
    }

    // Step 2: Create peer node
    let nodeId: string | undefined;
    if (config.nodeConfig) {
      const nodeConfig: CreateNodeConfig = {
        networkId,
        memberId,
        instanceType: config.nodeConfig.instanceType ?? 'bc.t3.small',
        availabilityZone: config.nodeConfig.availabilityZone ?? `${config.region}a`,
        stateDB: config.nodeConfig.stateDB ?? 'LevelDB',
        logPublishingConfiguration: config.enableLogging
          ? {
              fabric: {
                chaincodeLogs: { enabled: true },
                peerLogs: { enabled: true },
              },
            }
          : undefined,
        tags: {
          ...config.tags,
          'pact:client': config.clientName,
          'pact:managed': 'true',
        },
      };

      const nodeResult = await client.createNode(nodeConfig);
      if (nodeResult.success && nodeResult.data) {
        nodeId = nodeResult.data.nodeId;

        // Wait for node to become available
        await this.waitForNodeStatus(config.region, networkId, memberId, nodeId, 'AVAILABLE', 300000);
      }
    }

    // Step 3: Get final resource details
    const networkDetails = await client.getNetwork(networkId);
    const memberDetails = await client.getMember(networkId, memberId);
    const nodeDetails = nodeId
      ? await client.getNode(networkId, memberId, nodeId)
      : undefined;

    // Build endpoints
    const endpoints: NetworkDeploymentResult['endpoints'] = {};
    if (networkDetails.data?.frameworkAttributes?.fabric) {
      endpoints.orderer = networkDetails.data.frameworkAttributes.fabric.orderingServiceEndpoint;
    }
    if (memberDetails.data?.frameworkAttributes?.fabric) {
      endpoints.ca = memberDetails.data.frameworkAttributes.fabric.caEndpoint;
    }
    if (nodeDetails?.data?.frameworkAttributes?.fabric) {
      endpoints.peer = nodeDetails.data.frameworkAttributes.fabric.peerEndpoint;
    }

    return {
      success: true,
      data: {
        networkId,
        memberId,
        nodeId,
        network: networkDetails.data,
        member: memberDetails.data,
        node: nodeDetails?.data,
        endpoints,
      },
    };
  }

  /**
   * Add a member to an existing network
   */
  async addMember(
    region: string,
    networkId: string,
    memberConfig: {
      name: string;
      description?: string;
      adminUsername: string;
      adminPassword: string;
      kmsKeyArn?: string;
      tags?: Record<string, string>;
    }
  ): Promise<AMBOperationResult<{ memberId: string }>> {
    const client = await this.getClient(region);

    return client.createMember({
      networkId,
      name: memberConfig.name,
      description: memberConfig.description,
      frameworkConfiguration: {
        fabric: {
          adminUsername: memberConfig.adminUsername,
          adminPassword: memberConfig.adminPassword,
        },
      },
      kmsKeyArn: memberConfig.kmsKeyArn,
      tags: memberConfig.tags,
    });
  }

  /**
   * Add a node to a member
   */
  async addNode(
    region: string,
    networkId: string,
    memberId: string,
    nodeConfig?: {
      instanceType?: AMBInstanceType;
      availabilityZone?: string;
      stateDB?: 'LevelDB' | 'CouchDB';
      enableLogging?: boolean;
      tags?: Record<string, string>;
    }
  ): Promise<AMBOperationResult<{ nodeId: string }>> {
    const client = await this.getClient(region);

    return client.createNode({
      networkId,
      memberId,
      instanceType: nodeConfig?.instanceType ?? 'bc.t3.small',
      availabilityZone: nodeConfig?.availabilityZone ?? `${region}a`,
      stateDB: nodeConfig?.stateDB ?? 'LevelDB',
      logPublishingConfiguration: nodeConfig?.enableLogging
        ? {
            fabric: {
              chaincodeLogs: { enabled: true },
              peerLogs: { enabled: true },
            },
          }
        : undefined,
      tags: nodeConfig?.tags,
    });
  }

  /**
   * Get network status and health
   */
  async getNetworkStatus(region: string, networkId: string): Promise<NetworkStatus> {
    const client = await this.getClient(region);

    const networkResult = await client.getNetwork(networkId);
    const membersResult = await client.listMembers(networkId);

    const members = membersResult.data ?? [];
    const nodes: AMBNode[] = [];

    // Get nodes for all members
    for (const member of members) {
      const nodesResult = await client.listNodes(networkId, member.id);
      if (nodesResult.data) {
        nodes.push(...nodesResult.data);
      }
    }

    // Determine overall status
    let status: NetworkStatus['status'] = 'UNKNOWN';
    if (networkResult.data) {
      switch (networkResult.data.status) {
        case 'AVAILABLE':
          // Check if all nodes are healthy
          const unhealthyNodes = nodes.filter(
            (n) => n.status !== 'AVAILABLE' && n.status !== 'CREATING'
          );
          status = unhealthyNodes.length === 0 ? 'HEALTHY' : 'DEGRADED';
          break;
        case 'CREATING':
          status = 'CREATING';
          break;
        case 'CREATE_FAILED':
        case 'DELETING':
        case 'DELETED':
          status = 'UNHEALTHY';
          break;
      }
    }

    // Build health check
    const health: AMBHealthCheck = {
      network: {
        id: networkId,
        status: networkResult.data?.status ?? 'DELETED',
        healthy: networkResult.data?.status === 'AVAILABLE',
      },
      member: members.length > 0 && members[0]
        ? {
            id: members[0].id,
            status: members[0].status ?? 'CREATING',
            healthy: members[0].status === 'AVAILABLE',
          }
        : undefined,
      nodes: nodes.map((n) => ({
        id: n.id,
        status: n.status,
        healthy: n.status === 'AVAILABLE',
        endpoint: n.frameworkAttributes?.fabric?.peerEndpoint,
      })),
      overall: status === 'HEALTHY',
      timestamp: new Date().toISOString(),
    };

    const networkStatus: NetworkStatus = {
      networkId,
      networkName: networkResult.data?.name ?? 'Unknown',
      status,
      network: networkResult.data ?? null,
      members,
      nodes,
      health,
      lastUpdated: new Date().toISOString(),
    };

    // Cache the status
    this.networkCache.set(networkId, networkStatus);

    return networkStatus;
  }

  /**
   * List all networks in a region
   */
  async listNetworks(region: string): Promise<AMBOperationResult<AMBNetwork[]>> {
    const client = await this.getClient(region);
    return client.listNetworks({ framework: 'HYPERLEDGER_FABRIC' });
  }

  /**
   * Delete a network and all its resources
   */
  async deleteNetwork(
    region: string,
    networkId: string,
    options?: { deleteNodes?: boolean; deleteMember?: boolean }
  ): Promise<AMBOperationResult<void>> {
    const client = await this.getClient(region);

    // Get current status
    const status = await this.getNetworkStatus(region, networkId);

    // Delete nodes first if requested
    if (options?.deleteNodes) {
      for (const node of status.nodes) {
        await client.deleteNode(networkId, node.memberId, node.id);
      }

      // Wait for nodes to be deleted
      for (const node of status.nodes) {
        await this.waitForNodeStatus(
          region,
          networkId,
          node.memberId,
          node.id,
          'DELETED',
          300000
        );
      }
    }

    // Delete members if requested (except the last one)
    if (options?.deleteMember && status.members.length > 1) {
      for (const member of status.members.slice(1)) {
        await client.deleteMember(networkId, member.id);
      }
    }

    // Delete the network
    return client.deleteNetwork(networkId);
  }

  /**
   * Invite another AWS account to join the network
   */
  async inviteMember(
    region: string,
    networkId: string,
    inviterMemberId: string,
    inviteePrincipal: string,
    description?: string
  ): Promise<AMBOperationResult<{ proposalId: string }>> {
    const client = await this.getClient(region);

    return client.createProposal(
      networkId,
      inviterMemberId,
      { invitations: [{ principal: inviteePrincipal }] },
      description ?? `Invitation to join ARKA network ${networkId}`
    );
  }

  /**
   * Accept a network invitation
   */
  async acceptInvitation(
    region: string,
    invitationId: string,
    memberConfig: {
      name: string;
      adminUsername: string;
      adminPassword: string;
      kmsKeyArn?: string;
    }
  ): Promise<AMBOperationResult<{ memberId: string }>> {
    const client = await this.getClient(region);

    // Get invitation details to get network ID
    const invitations = await client.listInvitations();
    const invitation = invitations.data?.find((i) => i.invitationId === invitationId);

    if (!invitation) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found' },
      };
    }

    // Create member (this accepts the invitation)
    return client.createMember({
      networkId: invitation.networkSummary.id,
      name: memberConfig.name,
      frameworkConfiguration: {
        fabric: {
          adminUsername: memberConfig.adminUsername,
          adminPassword: memberConfig.adminPassword,
        },
      },
      kmsKeyArn: memberConfig.kmsKeyArn,
    });
  }

  /**
   * List pending invitations
   */
  async listInvitations(region: string): Promise<AMBOperationResult<AMBInvitation[]>> {
    const client = await this.getClient(region);
    return client.listInvitations();
  }

  /**
   * List pending proposals for a network
   */
  async listProposals(region: string, networkId: string): Promise<AMBOperationResult<AMBProposal[]>> {
    const client = await this.getClient(region);
    return client.listProposals(networkId);
  }

  /**
   * Vote on a proposal
   */
  async voteOnProposal(
    region: string,
    networkId: string,
    proposalId: string,
    voterMemberId: string,
    vote: 'YES' | 'NO'
  ): Promise<AMBOperationResult<void>> {
    const client = await this.getClient(region);
    return client.voteOnProposal(networkId, proposalId, voterMemberId, vote);
  }

  /**
   * Wait for network to reach a specific status
   */
  async waitForNetworkStatus(
    region: string,
    networkId: string,
    targetStatus: AMBNetwork['status'],
    timeoutMs: number = 300000
  ): Promise<boolean> {
    const client = await this.getClient(region);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await client.getNetwork(networkId);
      if (result.data?.status === targetStatus) {
        return true;
      }
      if (result.data?.status === 'CREATE_FAILED' || result.data?.status === 'DELETED') {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Check every 10 seconds
    }

    return false;
  }

  /**
   * Wait for node to reach a specific status
   */
  async waitForNodeStatus(
    region: string,
    networkId: string,
    memberId: string,
    nodeId: string,
    targetStatus: AMBNode['status'],
    timeoutMs: number = 300000
  ): Promise<boolean> {
    const client = await this.getClient(region);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await client.getNode(networkId, memberId, nodeId);
      if (result.data?.status === targetStatus) {
        return true;
      }
      if (result.data?.status === 'CREATE_FAILED' || result.data?.status === 'FAILED') {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Check every 5 seconds
    }

    return false;
  }

  /**
   * Subscribe to network events
   */
  subscribe(handler: AMBEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit event to subscribers
   */
  private async emitEvent(event: AMBEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error in AMB event handler:', error);
      }
    }
  }

  /**
   * Get cached network status
   */
  getCachedStatus(networkId: string): NetworkStatus | undefined {
    return this.networkCache.get(networkId);
  }

  /**
   * Clear status cache
   */
  clearCache(): void {
    this.networkCache.clear();
  }
}

// Singleton instance
let managerInstance: AMBNetworkManager | null = null;

/**
 * Get the global AMB Network Manager instance
 */
export function getAMBNetworkManager(): AMBNetworkManager {
  if (!managerInstance) {
    managerInstance = new AMBNetworkManager();
  }
  return managerInstance;
}

/**
 * Reset the AMB Network Manager (for testing)
 */
export function resetAMBNetworkManager(): void {
  managerInstance = null;
}
