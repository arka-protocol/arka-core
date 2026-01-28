/**
 * Amazon Managed Blockchain Client
 *
 * AWS SDK client wrapper for Amazon Managed Blockchain API operations.
 * Provides typed methods for all AMB management operations.
 *
 * Note: This module uses dynamic imports for AWS SDK to allow the package
 * to be used without AWS SDK installed (with reduced functionality).
 */

import type {
  AMBClientConfig,
  AMBNetwork,
  AMBMember,
  AMBNode,
  AMBProposal,
  AMBInvitation,
  ProposalVote,
  CreateNetworkConfig,
  CreateMemberConfig,
  CreateNodeConfig,
  AMBOperationResult,
  AMBEvent,
  AMBEventHandler,
} from './types.js';

/**
 * Response types from AWS SDK (simplified for type safety)
 */
interface CreateNetworkResponse {
  NetworkId?: string;
  MemberId?: string;
}

interface GetNetworkResponse {
  Network?: {
    Id?: string;
    Name?: string;
    Description?: string;
    Framework?: string;
    FrameworkVersion?: string;
    Status?: string;
    VotingPolicy?: {
      ApprovalThresholdPolicy?: {
        ThresholdPercentage?: number;
        ProposalDurationInHours?: number;
        ThresholdComparator?: string;
      };
    };
    FrameworkAttributes?: {
      Fabric?: {
        OrderingServiceEndpoint?: string;
        Edition?: string;
      };
      Ethereum?: {
        ChainId?: string;
      };
    };
    VpcEndpointServiceName?: string;
    Arn?: string;
    CreationDate?: Date;
    Tags?: Record<string, string>;
  };
}

interface ListNetworksResponse {
  Networks?: Array<{
    Id?: string;
    Name?: string;
    Description?: string;
    Framework?: string;
    FrameworkVersion?: string;
    Status?: string;
    Arn?: string;
    CreationDate?: Date;
  }>;
}

interface CreateMemberResponse {
  MemberId?: string;
}

interface GetMemberResponse {
  Member?: {
    Id?: string;
    Name?: string;
    Description?: string;
    Status?: string;
    FrameworkAttributes?: {
      Fabric?: {
        AdminUsername?: string;
        CaEndpoint?: string;
      };
    };
    KmsKeyArn?: string;
    Arn?: string;
    CreationDate?: Date;
    Tags?: Record<string, string>;
  };
}

interface ListMembersResponse {
  Members?: Array<{
    Id?: string;
    Name?: string;
    Description?: string;
    Status?: string;
    Arn?: string;
    CreationDate?: Date;
  }>;
}

interface CreateNodeResponse {
  NodeId?: string;
}

interface GetNodeResponse {
  Node?: {
    Id?: string;
    InstanceType?: string;
    AvailabilityZone?: string;
    Status?: string;
    FrameworkAttributes?: {
      Fabric?: {
        PeerEndpoint?: string;
        PeerEventEndpoint?: string;
      };
    };
    StateDB?: string;
    Arn?: string;
    CreationDate?: Date;
  };
}

interface ListNodesResponse {
  Nodes?: Array<{
    Id?: string;
    InstanceType?: string;
    AvailabilityZone?: string;
    Status?: string;
    Arn?: string;
    CreationDate?: Date;
  }>;
}

interface CreateProposalResponse {
  ProposalId?: string;
}

interface GetProposalResponse {
  Proposal?: {
    ProposalId?: string;
    Description?: string;
    Actions?: {
      Invitations?: Array<{ Principal?: string }>;
      Removals?: Array<{ MemberId?: string }>;
    };
    ProposedByMemberId?: string;
    ProposedByMemberName?: string;
    Status?: string;
    CreationDate?: Date;
    ExpirationDate?: Date;
    YesVoteCount?: number;
    NoVoteCount?: number;
    OutstandingVoteCount?: number;
    Arn?: string;
    Tags?: Record<string, string>;
  };
}

interface ListProposalsResponse {
  Proposals?: Array<{
    ProposalId?: string;
    Description?: string;
    ProposedByMemberId?: string;
    ProposedByMemberName?: string;
    Status?: string;
    CreationDate?: Date;
    ExpirationDate?: Date;
    Arn?: string;
  }>;
}

interface ListProposalVotesResponse {
  ProposalVotes?: Array<{
    MemberId?: string;
    MemberName?: string;
    Vote?: string;
  }>;
}

interface ListInvitationsResponse {
  Invitations?: Array<{
    InvitationId?: string;
    NetworkSummary?: {
      Id?: string;
      Name?: string;
      Status?: string;
      Framework?: string;
      FrameworkVersion?: string;
      CreationDate?: Date;
    };
    Status?: string;
    CreationDate?: Date;
    ExpirationDate?: Date;
    Arn?: string;
  }>;
}

/**
 * Generic AWS Client interface
 */
interface AWSClient {
  send<T>(command: unknown): Promise<T>;
}

/**
 * Amazon Managed Blockchain Client
 *
 * Provides methods for managing AMB networks, members, nodes, and proposals.
 * Uses AWS SDK v3 for API calls.
 */
export class AMBClient {
  private config: AMBClientConfig;
  private client: AWSClient | null = null;
  private eventHandlers: Set<AMBEventHandler> = new Set();

  constructor(config: AMBClientConfig) {
    this.config = config;
  }

  /**
   * Initialize the AWS SDK client
   */
  async initialize(): Promise<void> {
    try {
      // Dynamically import AWS SDK to avoid bundling if not needed
      const { ManagedBlockchainClient } = await import('@aws-sdk/client-managedblockchain');

      const clientConfig: Record<string, unknown> = {
        region: this.config.region,
      };

      if (this.config.credentials) {
        clientConfig.credentials = this.config.credentials;
      }

      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
      }

      if (this.config.maxRetries) {
        clientConfig.maxAttempts = this.config.maxRetries;
      }

      this.client = new ManagedBlockchainClient(clientConfig) as unknown as AWSClient;
    } catch {
      throw new Error(
        '@aws-sdk/client-managedblockchain not found. Install with: npm install @aws-sdk/client-managedblockchain'
      );
    }
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.client) {
      throw new Error('AMB client not initialized. Call initialize() first.');
    }
  }

  // ============================================
  // Network Operations
  // ============================================

  /**
   * Create a new AMB network
   */
  async createNetwork(config: CreateNetworkConfig): Promise<AMBOperationResult<{ networkId: string; memberId: string }>> {
    this.ensureInitialized();

    try {
      const { CreateNetworkCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new CreateNetworkCommand({
        Name: config.name,
        Description: config.description,
        Framework: config.framework,
        FrameworkVersion: config.frameworkVersion,
        FrameworkConfiguration: {
          Fabric: config.frameworkConfiguration.fabric
            ? { Edition: config.frameworkConfiguration.fabric.edition }
            : undefined,
        },
        VotingPolicy: {
          ApprovalThresholdPolicy: {
            ThresholdPercentage: config.votingPolicy.approvalThresholdPolicy.thresholdPercentage,
            ProposalDurationInHours: config.votingPolicy.approvalThresholdPolicy.proposalDurationInHours,
            ThresholdComparator: config.votingPolicy.approvalThresholdPolicy.thresholdComparator,
          },
        },
        MemberConfiguration: {
          Name: config.memberConfiguration.name,
          Description: config.memberConfiguration.description,
          FrameworkConfiguration: {
            Fabric: config.memberConfiguration.frameworkConfiguration.fabric
              ? {
                  AdminUsername: config.memberConfiguration.frameworkConfiguration.fabric.adminUsername,
                  AdminPassword: config.memberConfiguration.frameworkConfiguration.fabric.adminPassword,
                }
              : undefined,
          },
          LogPublishingConfiguration: config.memberConfiguration.logPublishingConfiguration as unknown as undefined,
          KmsKeyArn: config.memberConfiguration.kmsKeyArn,
          Tags: config.memberConfiguration.tags,
        },
        Tags: config.tags,
      });

      const response = await this.client!.send<CreateNetworkResponse>(command);

      await this.emitEvent({
        type: 'NETWORK_CREATED',
        timestamp: new Date().toISOString(),
        resourceId: response.NetworkId ?? '',
        resourceType: 'NETWORK',
        details: { memberId: response.MemberId },
      });

      return {
        success: true,
        data: {
          networkId: response.NetworkId ?? '',
          memberId: response.MemberId ?? '',
        },
      };
    } catch (error) {
      return this.handleError(error, 'createNetwork');
    }
  }

  /**
   * Get network details
   */
  async getNetwork(networkId: string): Promise<AMBOperationResult<AMBNetwork>> {
    this.ensureInitialized();

    try {
      const { GetNetworkCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new GetNetworkCommand({ NetworkId: networkId });
      const response = await this.client!.send<GetNetworkResponse>(command);

      if (!response.Network) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Network not found' } };
      }

      const network: AMBNetwork = {
        id: response.Network.Id ?? '',
        name: response.Network.Name ?? '',
        description: response.Network.Description,
        framework: response.Network.Framework as AMBNetwork['framework'],
        frameworkVersion: response.Network.FrameworkVersion ?? '',
        status: response.Network.Status as AMBNetwork['status'],
        votingPolicy: {
          approvalThresholdPolicy: {
            thresholdPercentage: response.Network.VotingPolicy?.ApprovalThresholdPolicy?.ThresholdPercentage ?? 50,
            proposalDurationInHours: response.Network.VotingPolicy?.ApprovalThresholdPolicy?.ProposalDurationInHours ?? 24,
            thresholdComparator: (response.Network.VotingPolicy?.ApprovalThresholdPolicy?.ThresholdComparator ?? 'GREATER_THAN') as 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL_TO',
          },
        },
        frameworkAttributes: response.Network.FrameworkAttributes
          ? {
              fabric: response.Network.FrameworkAttributes.Fabric
                ? {
                    orderingServiceEndpoint: response.Network.FrameworkAttributes.Fabric.OrderingServiceEndpoint ?? '',
                    edition: response.Network.FrameworkAttributes.Fabric.Edition as 'STARTER' | 'STANDARD',
                  }
                : undefined,
              ethereum: response.Network.FrameworkAttributes.Ethereum
                ? { chainId: response.Network.FrameworkAttributes.Ethereum.ChainId ?? '' }
                : undefined,
            }
          : undefined,
        vpcEndpointServiceName: response.Network.VpcEndpointServiceName,
        arn: response.Network.Arn,
        creationDate: response.Network.CreationDate,
        tags: response.Network.Tags,
      };

      return { success: true, data: network };
    } catch (error) {
      return this.handleError(error, 'getNetwork');
    }
  }

  /**
   * List all networks accessible to the account
   */
  async listNetworks(
    options?: { framework?: string; status?: string; name?: string }
  ): Promise<AMBOperationResult<AMBNetwork[]>> {
    this.ensureInitialized();

    try {
      const { ListNetworksCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new ListNetworksCommand({
        Framework: options?.framework as 'HYPERLEDGER_FABRIC' | 'ETHEREUM' | undefined,
        Status: options?.status as 'CREATING' | 'AVAILABLE' | 'CREATE_FAILED' | 'DELETING' | 'DELETED' | undefined,
        Name: options?.name,
      });

      const response = await this.client!.send<ListNetworksResponse>(command);

      const networks: AMBNetwork[] = (response.Networks ?? []).map((n) => ({
        id: n.Id ?? '',
        name: n.Name ?? '',
        description: n.Description,
        framework: n.Framework as AMBNetwork['framework'],
        frameworkVersion: n.FrameworkVersion ?? '',
        status: n.Status as AMBNetwork['status'],
        votingPolicy: {
          approvalThresholdPolicy: {
            thresholdPercentage: 50,
            proposalDurationInHours: 24,
            thresholdComparator: 'GREATER_THAN' as const,
          },
        },
        arn: n.Arn,
        creationDate: n.CreationDate,
      }));

      return { success: true, data: networks };
    } catch (error) {
      return this.handleError(error, 'listNetworks');
    }
  }

  /**
   * Delete a network
   */
  async deleteNetwork(networkId: string): Promise<AMBOperationResult<void>> {
    this.ensureInitialized();

    try {
      // Note: DeleteNetwork not available in all regions - use member deletion instead
      const mod = await import('@aws-sdk/client-managedblockchain');
      const DeleteNetworkCommand = (mod as Record<string, unknown>).DeleteNetworkCommand as new (input: { NetworkId: string }) => unknown;

      const command = new DeleteNetworkCommand({ NetworkId: networkId });
      await this.client!.send(command);

      await this.emitEvent({
        type: 'NETWORK_DELETED',
        timestamp: new Date().toISOString(),
        resourceId: networkId,
        resourceType: 'NETWORK',
      });

      return { success: true };
    } catch (error) {
      return this.handleError(error, 'deleteNetwork');
    }
  }

  // ============================================
  // Member Operations
  // ============================================

  /**
   * Create a new member in an existing network
   */
  async createMember(config: CreateMemberConfig): Promise<AMBOperationResult<{ memberId: string }>> {
    this.ensureInitialized();

    try {
      const { CreateMemberCommand } = await import('@aws-sdk/client-managedblockchain');

      // InvitationId is required when joining an existing network via invitation
      // For networks you create, use createNetwork instead
      const commandInput = {
        NetworkId: config.networkId,
        InvitationId: config.invitationId ?? '',
        MemberConfiguration: {
          Name: config.name,
          Description: config.description,
          FrameworkConfiguration: {
            Fabric: config.frameworkConfiguration.fabric
              ? {
                  AdminUsername: config.frameworkConfiguration.fabric.adminUsername,
                  AdminPassword: config.frameworkConfiguration.fabric.adminPassword,
                }
              : undefined,
          },
          LogPublishingConfiguration: config.logPublishingConfiguration as unknown as undefined,
          KmsKeyArn: config.kmsKeyArn,
          Tags: config.tags,
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const command = new CreateMemberCommand(commandInput as any);

      const response = await this.client!.send<CreateMemberResponse>(command);

      await this.emitEvent({
        type: 'MEMBER_CREATED',
        timestamp: new Date().toISOString(),
        resourceId: response.MemberId ?? '',
        resourceType: 'MEMBER',
        details: { networkId: config.networkId },
      });

      return {
        success: true,
        data: { memberId: response.MemberId ?? '' },
      };
    } catch (error) {
      return this.handleError(error, 'createMember');
    }
  }

  /**
   * Get member details
   */
  async getMember(networkId: string, memberId: string): Promise<AMBOperationResult<AMBMember>> {
    this.ensureInitialized();

    try {
      const { GetMemberCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new GetMemberCommand({ NetworkId: networkId, MemberId: memberId });
      const response = await this.client!.send<GetMemberResponse>(command);

      if (!response.Member) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } };
      }

      const member: AMBMember = {
        networkId,
        id: response.Member.Id ?? '',
        name: response.Member.Name ?? '',
        description: response.Member.Description,
        status: response.Member.Status as AMBMember['status'],
        frameworkAttributes: response.Member.FrameworkAttributes
          ? {
              fabric: response.Member.FrameworkAttributes.Fabric
                ? {
                    adminUsername: response.Member.FrameworkAttributes.Fabric.AdminUsername ?? '',
                    caEndpoint: response.Member.FrameworkAttributes.Fabric.CaEndpoint ?? '',
                  }
                : undefined,
            }
          : undefined,
        kmsKeyArn: response.Member.KmsKeyArn,
        arn: response.Member.Arn,
        creationDate: response.Member.CreationDate,
        tags: response.Member.Tags,
      };

      return { success: true, data: member };
    } catch (error) {
      return this.handleError(error, 'getMember');
    }
  }

  /**
   * List members in a network
   */
  async listMembers(networkId: string): Promise<AMBOperationResult<AMBMember[]>> {
    this.ensureInitialized();

    try {
      const { ListMembersCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new ListMembersCommand({ NetworkId: networkId });
      const response = await this.client!.send<ListMembersResponse>(command);

      const members: AMBMember[] = (response.Members ?? []).map((m) => ({
        networkId,
        id: m.Id ?? '',
        name: m.Name ?? '',
        description: m.Description,
        status: m.Status as AMBMember['status'],
        arn: m.Arn,
        creationDate: m.CreationDate,
      }));

      return { success: true, data: members };
    } catch (error) {
      return this.handleError(error, 'listMembers');
    }
  }

  /**
   * Delete a member
   */
  async deleteMember(networkId: string, memberId: string): Promise<AMBOperationResult<void>> {
    this.ensureInitialized();

    try {
      const { DeleteMemberCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new DeleteMemberCommand({ NetworkId: networkId, MemberId: memberId });
      await this.client!.send(command);

      await this.emitEvent({
        type: 'MEMBER_DELETED',
        timestamp: new Date().toISOString(),
        resourceId: memberId,
        resourceType: 'MEMBER',
        details: { networkId },
      });

      return { success: true };
    } catch (error) {
      return this.handleError(error, 'deleteMember');
    }
  }

  // ============================================
  // Node Operations
  // ============================================

  /**
   * Create a new node for a member
   */
  async createNode(config: CreateNodeConfig): Promise<AMBOperationResult<{ nodeId: string }>> {
    this.ensureInitialized();

    try {
      const { CreateNodeCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new CreateNodeCommand({
        NetworkId: config.networkId,
        MemberId: config.memberId,
        NodeConfiguration: {
          InstanceType: config.instanceType,
          AvailabilityZone: config.availabilityZone,
          LogPublishingConfiguration: config.logPublishingConfiguration as unknown as undefined,
          StateDB: config.stateDB,
        },
        Tags: config.tags,
      });

      const response = await this.client!.send<CreateNodeResponse>(command);

      await this.emitEvent({
        type: 'NODE_CREATED',
        timestamp: new Date().toISOString(),
        resourceId: response.NodeId ?? '',
        resourceType: 'NODE',
        details: { networkId: config.networkId, memberId: config.memberId },
      });

      return {
        success: true,
        data: { nodeId: response.NodeId ?? '' },
      };
    } catch (error) {
      return this.handleError(error, 'createNode');
    }
  }

  /**
   * Get node details
   */
  async getNode(networkId: string, memberId: string, nodeId: string): Promise<AMBOperationResult<AMBNode>> {
    this.ensureInitialized();

    try {
      const { GetNodeCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new GetNodeCommand({
        NetworkId: networkId,
        MemberId: memberId,
        NodeId: nodeId,
      });
      const response = await this.client!.send<GetNodeResponse>(command);

      if (!response.Node) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } };
      }

      const node: AMBNode = {
        networkId,
        memberId,
        id: response.Node.Id ?? '',
        instanceType: response.Node.InstanceType as AMBNode['instanceType'],
        availabilityZone: response.Node.AvailabilityZone ?? '',
        status: response.Node.Status as AMBNode['status'],
        frameworkAttributes: response.Node.FrameworkAttributes
          ? {
              fabric: response.Node.FrameworkAttributes.Fabric
                ? {
                    peerEndpoint: response.Node.FrameworkAttributes.Fabric.PeerEndpoint,
                    peerEventEndpoint: response.Node.FrameworkAttributes.Fabric.PeerEventEndpoint,
                  }
                : undefined,
            }
          : undefined,
        stateDB: response.Node.StateDB as AMBNode['stateDB'],
        arn: response.Node.Arn,
        creationDate: response.Node.CreationDate,
      };

      return { success: true, data: node };
    } catch (error) {
      return this.handleError(error, 'getNode');
    }
  }

  /**
   * List nodes for a member
   */
  async listNodes(networkId: string, memberId: string): Promise<AMBOperationResult<AMBNode[]>> {
    this.ensureInitialized();

    try {
      const { ListNodesCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new ListNodesCommand({
        NetworkId: networkId,
        MemberId: memberId,
      });
      const response = await this.client!.send<ListNodesResponse>(command);

      const nodes: AMBNode[] = (response.Nodes ?? []).map((n) => ({
        networkId,
        memberId,
        id: n.Id ?? '',
        instanceType: n.InstanceType as AMBNode['instanceType'],
        availabilityZone: n.AvailabilityZone ?? '',
        status: n.Status as AMBNode['status'],
        arn: n.Arn,
        creationDate: n.CreationDate,
      }));

      return { success: true, data: nodes };
    } catch (error) {
      return this.handleError(error, 'listNodes');
    }
  }

  /**
   * Delete a node
   */
  async deleteNode(networkId: string, memberId: string, nodeId: string): Promise<AMBOperationResult<void>> {
    this.ensureInitialized();

    try {
      const { DeleteNodeCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new DeleteNodeCommand({
        NetworkId: networkId,
        MemberId: memberId,
        NodeId: nodeId,
      });
      await this.client!.send(command);

      await this.emitEvent({
        type: 'NODE_DELETED',
        timestamp: new Date().toISOString(),
        resourceId: nodeId,
        resourceType: 'NODE',
        details: { networkId, memberId },
      });

      return { success: true };
    } catch (error) {
      return this.handleError(error, 'deleteNode');
    }
  }

  // ============================================
  // Proposal Operations
  // ============================================

  /**
   * Create a proposal to invite or remove members
   */
  async createProposal(
    networkId: string,
    memberId: string,
    actions: {
      invitations?: Array<{ principal: string }>;
      removals?: Array<{ memberId: string }>;
    },
    description?: string
  ): Promise<AMBOperationResult<{ proposalId: string }>> {
    this.ensureInitialized();

    try {
      const { CreateProposalCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new CreateProposalCommand({
        NetworkId: networkId,
        MemberId: memberId,
        Actions: {
          Invitations: actions.invitations?.map((i) => ({ Principal: i.principal })),
          Removals: actions.removals?.map((r) => ({ MemberId: r.memberId })),
        },
        Description: description,
      });

      const response = await this.client!.send<CreateProposalResponse>(command);

      await this.emitEvent({
        type: 'PROPOSAL_CREATED',
        timestamp: new Date().toISOString(),
        resourceId: response.ProposalId ?? '',
        resourceType: 'PROPOSAL',
        details: { networkId, memberId },
      });

      return {
        success: true,
        data: { proposalId: response.ProposalId ?? '' },
      };
    } catch (error) {
      return this.handleError(error, 'createProposal');
    }
  }

  /**
   * Get proposal details
   */
  async getProposal(networkId: string, proposalId: string): Promise<AMBOperationResult<AMBProposal>> {
    this.ensureInitialized();

    try {
      const { GetProposalCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new GetProposalCommand({
        NetworkId: networkId,
        ProposalId: proposalId,
      });
      const response = await this.client!.send<GetProposalResponse>(command);

      if (!response.Proposal) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } };
      }

      const proposal: AMBProposal = {
        proposalId: response.Proposal.ProposalId ?? '',
        networkId,
        description: response.Proposal.Description,
        actions: {
          invitations: response.Proposal.Actions?.Invitations?.map((i) => ({
            principal: i.Principal ?? '',
          })),
          removals: response.Proposal.Actions?.Removals?.map((r) => ({
            memberId: r.MemberId ?? '',
          })),
        },
        proposedByMemberId: response.Proposal.ProposedByMemberId ?? '',
        proposedByMemberName: response.Proposal.ProposedByMemberName ?? '',
        status: response.Proposal.Status as AMBProposal['status'],
        creationDate: response.Proposal.CreationDate ?? new Date(),
        expirationDate: response.Proposal.ExpirationDate ?? new Date(),
        yesVoteCount: response.Proposal.YesVoteCount,
        noVoteCount: response.Proposal.NoVoteCount,
        outstandingVoteCount: response.Proposal.OutstandingVoteCount,
        arn: response.Proposal.Arn,
        tags: response.Proposal.Tags,
      };

      return { success: true, data: proposal };
    } catch (error) {
      return this.handleError(error, 'getProposal');
    }
  }

  /**
   * Vote on a proposal
   */
  async voteOnProposal(
    networkId: string,
    proposalId: string,
    voterMemberId: string,
    vote: 'YES' | 'NO'
  ): Promise<AMBOperationResult<void>> {
    this.ensureInitialized();

    try {
      const { VoteOnProposalCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new VoteOnProposalCommand({
        NetworkId: networkId,
        ProposalId: proposalId,
        VoterMemberId: voterMemberId,
        Vote: vote,
      });
      await this.client!.send(command);

      await this.emitEvent({
        type: 'PROPOSAL_VOTED',
        timestamp: new Date().toISOString(),
        resourceId: proposalId,
        resourceType: 'PROPOSAL',
        details: { networkId, voterMemberId, vote },
      });

      return { success: true };
    } catch (error) {
      return this.handleError(error, 'voteOnProposal');
    }
  }

  /**
   * List proposals for a network
   */
  async listProposals(networkId: string): Promise<AMBOperationResult<AMBProposal[]>> {
    this.ensureInitialized();

    try {
      const { ListProposalsCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new ListProposalsCommand({ NetworkId: networkId });
      const response = await this.client!.send<ListProposalsResponse>(command);

      const proposals: AMBProposal[] = (response.Proposals ?? []).map((p) => ({
        proposalId: p.ProposalId ?? '',
        networkId,
        description: p.Description,
        actions: {
          invitations: [],
          removals: [],
        },
        proposedByMemberId: p.ProposedByMemberId ?? '',
        proposedByMemberName: p.ProposedByMemberName ?? '',
        status: p.Status as AMBProposal['status'],
        creationDate: p.CreationDate ?? new Date(),
        expirationDate: p.ExpirationDate ?? new Date(),
        arn: p.Arn,
      }));

      return { success: true, data: proposals };
    } catch (error) {
      return this.handleError(error, 'listProposals');
    }
  }

  /**
   * List votes on a proposal
   */
  async listProposalVotes(networkId: string, proposalId: string): Promise<AMBOperationResult<ProposalVote[]>> {
    this.ensureInitialized();

    try {
      const { ListProposalVotesCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new ListProposalVotesCommand({
        NetworkId: networkId,
        ProposalId: proposalId,
      });
      const response = await this.client!.send<ListProposalVotesResponse>(command);

      const votes: ProposalVote[] = (response.ProposalVotes ?? []).map((v) => ({
        memberId: v.MemberId ?? '',
        memberName: v.MemberName ?? '',
        vote: v.Vote as 'YES' | 'NO',
      }));

      return { success: true, data: votes };
    } catch (error) {
      return this.handleError(error, 'listProposalVotes');
    }
  }

  // ============================================
  // Invitation Operations
  // ============================================

  /**
   * List invitations for the current account
   */
  async listInvitations(): Promise<AMBOperationResult<AMBInvitation[]>> {
    this.ensureInitialized();

    try {
      const { ListInvitationsCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new ListInvitationsCommand({});
      const response = await this.client!.send<ListInvitationsResponse>(command);

      const invitations: AMBInvitation[] = (response.Invitations ?? []).map((i) => ({
        invitationId: i.InvitationId ?? '',
        networkSummary: {
          id: i.NetworkSummary?.Id ?? '',
          name: i.NetworkSummary?.Name ?? '',
          status: i.NetworkSummary?.Status as AMBInvitation['networkSummary']['status'],
          framework: i.NetworkSummary?.Framework as AMBInvitation['networkSummary']['framework'],
          frameworkVersion: i.NetworkSummary?.FrameworkVersion ?? '',
          creationDate: i.NetworkSummary?.CreationDate,
        },
        status: i.Status as AMBInvitation['status'],
        creationDate: i.CreationDate ?? new Date(),
        expirationDate: i.ExpirationDate,
        arn: i.Arn,
      }));

      return { success: true, data: invitations };
    } catch (error) {
      return this.handleError(error, 'listInvitations');
    }
  }

  /**
   * Reject an invitation
   */
  async rejectInvitation(invitationId: string): Promise<AMBOperationResult<void>> {
    this.ensureInitialized();

    try {
      const { RejectInvitationCommand } = await import('@aws-sdk/client-managedblockchain');

      const command = new RejectInvitationCommand({ InvitationId: invitationId });
      await this.client!.send(command);

      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectInvitation');
    }
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Subscribe to AMB events
   */
  subscribe(handler: AMBEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all subscribers
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
   * Handle and format errors
   */
  private handleError(error: unknown, operation: string): AMBOperationResult<never> {
    const err = error as { name?: string; message?: string };
    return {
      success: false,
      error: {
        code: err.name ?? 'UNKNOWN_ERROR',
        message: err.message ?? `${operation} failed`,
        details: err,
      },
    };
  }
}

/**
 * Create an AMB client for a specific region
 */
export function createAMBClient(region: string, options?: Partial<AMBClientConfig>): AMBClient {
  return new AMBClient({
    region,
    ...options,
  });
}
