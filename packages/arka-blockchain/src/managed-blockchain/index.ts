/**
 * Amazon Managed Blockchain Module
 *
 * Provides integration with Amazon Managed Blockchain for
 * deploying and managing private Hyperledger Fabric networks.
 *
 * @packageDocumentation
 */

// Types
export type {
  AMBFramework,
  AMBNetworkStatus,
  AMBMemberStatus,
  AMBNodeStatus,
  AMBInstanceType,
  FabricEdition,
  FabricVersion,
  VotingPolicy,
  NetworkFrameworkConfiguration,
  MemberFrameworkConfiguration,
  NodeFrameworkConfiguration,
  LogConfiguration,
  AMBNetwork,
  AMBMember,
  AMBNode,
  CreateNetworkConfig,
  CreateMemberConfig,
  CreateNodeConfig,
  AMBBlockchainConfig,
  AMBOperationResult,
  AMBProposal,
  ProposalActions,
  ProposalVote,
  AMBInvitation,
  AMBHealthCheck,
  AMBEvent,
  AMBEventHandler,
  AMBClientConfig,
} from './types.js';

// AMB Adapter
export {
  AmazonManagedBlockchainAdapter,
  createAMBAdapter,
  createAMBAdapterForRegion,
} from './amb-adapter.js';

// AMB Client
export { AMBClient, createAMBClient } from './amb-client.js';

// Network Manager
export {
  AMBNetworkManager,
  getAMBNetworkManager,
  resetAMBNetworkManager,
  type ClientNetworkConfig,
  type NetworkDeploymentResult,
  type NetworkStatus,
} from './network-manager.js';
