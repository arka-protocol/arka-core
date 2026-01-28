/**
 * Amazon Managed Blockchain Types
 *
 * Type definitions for AMB integration in ARKA Protocol.
 * Supports both Hyperledger Fabric and Ethereum networks.
 */

import type { BlockchainConfig } from '../types.js';

/**
 * AMB network framework types
 */
export type AMBFramework = 'HYPERLEDGER_FABRIC' | 'ETHEREUM';

/**
 * AMB network status
 */
export type AMBNetworkStatus =
  | 'CREATING'
  | 'AVAILABLE'
  | 'CREATE_FAILED'
  | 'DELETING'
  | 'DELETED';

/**
 * AMB member status
 */
export type AMBMemberStatus =
  | 'CREATING'
  | 'AVAILABLE'
  | 'CREATE_FAILED'
  | 'UPDATING'
  | 'DELETING'
  | 'DELETED'
  | 'INACCESSIBLE_ENCRYPTION_KEY';

/**
 * AMB node status
 */
export type AMBNodeStatus =
  | 'CREATING'
  | 'AVAILABLE'
  | 'UNHEALTHY'
  | 'CREATE_FAILED'
  | 'UPDATING'
  | 'DELETING'
  | 'DELETED'
  | 'FAILED'
  | 'INACCESSIBLE_ENCRYPTION_KEY';

/**
 * AMB node instance types
 */
export type AMBInstanceType =
  | 'bc.t3.small'
  | 'bc.t3.medium'
  | 'bc.t3.large'
  | 'bc.t3.xlarge'
  | 'bc.m5.large'
  | 'bc.m5.xlarge'
  | 'bc.m5.2xlarge'
  | 'bc.m5.4xlarge'
  | 'bc.c5.large'
  | 'bc.c5.xlarge'
  | 'bc.c5.2xlarge'
  | 'bc.c5.4xlarge';

/**
 * Hyperledger Fabric edition
 */
export type FabricEdition = 'STARTER' | 'STANDARD';

/**
 * Hyperledger Fabric versions supported by AMB
 */
export type FabricVersion = '1.4' | '2.2';

/**
 * Voting policy for network proposals
 */
export interface VotingPolicy {
  /** Approval threshold type */
  approvalThresholdPolicy: {
    /** Percentage of votes needed */
    thresholdPercentage: number;
    /** How long to wait for votes (hours) */
    proposalDurationInHours: number;
    /** Threshold comparator */
    thresholdComparator: 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL_TO';
  };
}

/**
 * Network framework configuration
 */
export interface NetworkFrameworkConfiguration {
  fabric?: {
    /** Fabric edition */
    edition: FabricEdition;
  };
}

/**
 * Member framework configuration
 */
export interface MemberFrameworkConfiguration {
  fabric?: {
    /** Admin username for the member */
    adminUsername: string;
    /** Admin password (min 8 chars, alphanumeric with special) */
    adminPassword: string;
  };
}

/**
 * Node framework configuration
 */
export interface NodeFrameworkConfiguration {
  fabric?: {
    /** Peer node endpoint */
    peerEndpoint?: string;
    /** Event endpoint */
    peerEventEndpoint?: string;
  };
}

/**
 * Log configuration for nodes
 */
export interface LogConfiguration {
  enabled: boolean;
  cloudwatchLogGroupName?: string;
}

/**
 * AMB Network definition
 */
export interface AMBNetwork {
  /** Network ID */
  id: string;
  /** Network name */
  name: string;
  /** Network description */
  description?: string;
  /** Framework type */
  framework: AMBFramework;
  /** Framework version */
  frameworkVersion: string;
  /** Network status */
  status: AMBNetworkStatus;
  /** Voting policy */
  votingPolicy: VotingPolicy;
  /** Framework configuration */
  frameworkAttributes?: {
    fabric?: {
      /** Ordering service endpoint */
      orderingServiceEndpoint: string;
      /** Fabric edition */
      edition: FabricEdition;
    };
    ethereum?: {
      /** Chain ID */
      chainId: string;
    };
  };
  /** VPC endpoint service name */
  vpcEndpointServiceName?: string;
  /** ARN of the network */
  arn?: string;
  /** Creation timestamp */
  creationDate?: Date;
  /** Tags */
  tags?: Record<string, string>;
}

/**
 * AMB Member definition
 */
export interface AMBMember {
  /** Network ID */
  networkId: string;
  /** Member ID */
  id: string;
  /** Member name */
  name: string;
  /** Member description */
  description?: string;
  /** Member status */
  status: AMBMemberStatus;
  /** Framework attributes */
  frameworkAttributes?: {
    fabric?: {
      /** Admin username */
      adminUsername: string;
      /** CA endpoint */
      caEndpoint: string;
    };
  };
  /** Log publishing configuration */
  logPublishingConfiguration?: {
    fabric?: {
      caLogs?: LogConfiguration;
    };
  };
  /** KMS key ARN for encryption */
  kmsKeyArn?: string;
  /** ARN of the member */
  arn?: string;
  /** Creation timestamp */
  creationDate?: Date;
  /** Tags */
  tags?: Record<string, string>;
}

/**
 * AMB Node definition
 */
export interface AMBNode {
  /** Network ID */
  networkId: string;
  /** Member ID */
  memberId: string;
  /** Node ID */
  id: string;
  /** Instance type */
  instanceType: AMBInstanceType;
  /** Availability zone */
  availabilityZone: string;
  /** Node status */
  status: AMBNodeStatus;
  /** Framework attributes */
  frameworkAttributes?: NodeFrameworkConfiguration;
  /** Log publishing configuration */
  logPublishingConfiguration?: {
    fabric?: {
      chaincodeLogs?: LogConfiguration;
      peerLogs?: LogConfiguration;
    };
  };
  /** State database type */
  stateDB?: 'LevelDB' | 'CouchDB';
  /** ARN of the node */
  arn?: string;
  /** Creation timestamp */
  creationDate?: Date;
}

/**
 * Configuration for creating a new AMB network
 */
export interface CreateNetworkConfig {
  /** Network name (unique within account) */
  name: string;
  /** Network description */
  description?: string;
  /** Framework type */
  framework: AMBFramework;
  /** Framework version */
  frameworkVersion: FabricVersion;
  /** Framework configuration */
  frameworkConfiguration: NetworkFrameworkConfiguration;
  /** Voting policy for proposals */
  votingPolicy: VotingPolicy;
  /** Initial member configuration */
  memberConfiguration: {
    name: string;
    description?: string;
    frameworkConfiguration: MemberFrameworkConfiguration;
    logPublishingConfiguration?: {
      fabric?: {
        caLogs?: LogConfiguration;
      };
    };
    kmsKeyArn?: string;
    tags?: Record<string, string>;
  };
  /** Tags for the network */
  tags?: Record<string, string>;
}

/**
 * Configuration for creating a new AMB member
 */
export interface CreateMemberConfig {
  /** Network ID to join */
  networkId: string;
  /** Invitation ID (required when joining via invitation) */
  invitationId?: string;
  /** Member name */
  name: string;
  /** Member description */
  description?: string;
  /** Framework configuration */
  frameworkConfiguration: MemberFrameworkConfiguration;
  /** Log publishing configuration */
  logPublishingConfiguration?: {
    fabric?: {
      caLogs?: LogConfiguration;
    };
  };
  /** KMS key ARN for encryption */
  kmsKeyArn?: string;
  /** Tags */
  tags?: Record<string, string>;
}

/**
 * Configuration for creating a new AMB node
 */
export interface CreateNodeConfig {
  /** Network ID */
  networkId: string;
  /** Member ID */
  memberId: string;
  /** Instance type */
  instanceType: AMBInstanceType;
  /** Availability zone */
  availabilityZone: string;
  /** Log publishing configuration */
  logPublishingConfiguration?: {
    fabric?: {
      chaincodeLogs?: LogConfiguration;
      peerLogs?: LogConfiguration;
    };
  };
  /** State database type */
  stateDB?: 'LevelDB' | 'CouchDB';
  /** Tags */
  tags?: Record<string, string>;
}

/**
 * AMB-specific blockchain configuration extending base config
 */
export interface AMBBlockchainConfig extends BlockchainConfig {
  network: 'hyperledger-fabric';
  /** AWS region */
  region: string;
  /** AMB Network ID */
  networkId: string;
  /** AMB Member ID */
  memberId: string;
  /** AMB Node ID(s) */
  nodeIds: string[];
  /** Use VPC endpoint for private access */
  useVpcEndpoint?: boolean;
  /** VPC endpoint URL (if using private access) */
  vpcEndpointUrl?: string;
  /** AWS credentials configuration */
  awsCredentials?: {
    /** IAM role ARN to assume */
    roleArn?: string;
    /** Access key ID (not recommended, use role assumption) */
    accessKeyId?: string;
    /** Secret access key (not recommended, use role assumption) */
    secretAccessKey?: string;
    /** Session token for temporary credentials */
    sessionToken?: string;
  };
  /** Fabric-specific AMB settings */
  fabricSettings?: {
    /** CA endpoint for identity management */
    caEndpoint?: string;
    /** Orderer endpoint */
    ordererEndpoint?: string;
    /** Peer endpoints */
    peerEndpoints?: string[];
  };
}

/**
 * Result of network operations
 */
export interface AMBOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Proposal action types
 */
export interface ProposalActions {
  invitations?: Array<{
    principal: string;
  }>;
  removals?: Array<{
    memberId: string;
  }>;
}

/**
 * Proposal for network changes (Fabric)
 */
export interface AMBProposal {
  /** Proposal ID */
  proposalId: string;
  /** Network ID */
  networkId: string;
  /** Description */
  description?: string;
  /** Actions in the proposal */
  actions: ProposalActions;
  /** Proposed by member ID */
  proposedByMemberId: string;
  /** Proposed by member name */
  proposedByMemberName: string;
  /** Proposal status */
  status: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'ACTION_FAILED';
  /** Creation timestamp */
  creationDate: Date;
  /** Expiration timestamp */
  expirationDate: Date;
  /** Vote summary */
  yesVoteCount?: number;
  noVoteCount?: number;
  outstandingVoteCount?: number;
  /** ARN */
  arn?: string;
  /** Tags */
  tags?: Record<string, string>;
}

/**
 * Vote on a proposal
 */
export interface ProposalVote {
  /** Voter member ID */
  memberId: string;
  /** Member name */
  memberName: string;
  /** Vote value */
  vote: 'YES' | 'NO';
}

/**
 * Invitation to join a network
 */
export interface AMBInvitation {
  /** Invitation ID */
  invitationId: string;
  /** Network summary */
  networkSummary: {
    id: string;
    name: string;
    status: AMBNetworkStatus;
    framework: AMBFramework;
    frameworkVersion: string;
    creationDate?: Date;
  };
  /** Invitation status */
  status: 'PENDING' | 'ACCEPTED' | 'ACCEPTING' | 'REJECTED' | 'EXPIRED';
  /** Creation timestamp */
  creationDate: Date;
  /** Expiration timestamp */
  expirationDate?: Date;
  /** ARN */
  arn?: string;
}

/**
 * Network health check result
 */
export interface AMBHealthCheck {
  /** Network health */
  network: {
    id: string;
    status: AMBNetworkStatus;
    healthy: boolean;
  };
  /** Member health */
  member?: {
    id: string;
    status: AMBMemberStatus;
    healthy: boolean;
  };
  /** Node health */
  nodes: Array<{
    id: string;
    status: AMBNodeStatus;
    healthy: boolean;
    endpoint?: string;
  }>;
  /** Overall health */
  overall: boolean;
  /** Timestamp */
  timestamp: string;
}

/**
 * Events from AMB operations
 */
export interface AMBEvent {
  type:
    | 'NETWORK_CREATED'
    | 'NETWORK_DELETED'
    | 'MEMBER_CREATED'
    | 'MEMBER_DELETED'
    | 'NODE_CREATED'
    | 'NODE_DELETED'
    | 'NODE_UPDATED'
    | 'PROPOSAL_CREATED'
    | 'PROPOSAL_VOTED'
    | 'PROPOSAL_COMPLETED'
    | 'ERROR';
  timestamp: string;
  resourceId: string;
  resourceType: 'NETWORK' | 'MEMBER' | 'NODE' | 'PROPOSAL';
  details?: Record<string, unknown>;
  error?: Error;
}

/**
 * AMB event handler type
 */
export type AMBEventHandler = (event: AMBEvent) => void | Promise<void>;

/**
 * Client configuration for AMB service
 */
export interface AMBClientConfig {
  /** AWS region */
  region: string;
  /** AWS credentials */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  /** IAM role to assume */
  roleArn?: string;
  /** Custom endpoint (for testing or VPC endpoints) */
  endpoint?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Maximum retries */
  maxRetries?: number;
}
