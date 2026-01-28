/**
 * Entity Identity Binding
 *
 * Binds ARKA entities to blockchain identities for global interoperability.
 *
 * Supported identity types:
 * - DID (Decentralized ID)
 * - ENS-like identifiers
 * - NFT identity tokens
 * - Soulbound compliance tokens
 *
 * Benefits:
 * - Global interoperability
 * - "Follow-the-entity" compliance across systems
 */

import { createHash } from 'crypto';
import { canonicalSerialize } from '@arka-protocol/crypto';
import { createLogger, ids } from '@arka-protocol/utils';
import type { ArkaEntity } from '@arka-protocol/types';
import type { BlockchainAdapter } from './types.js';

const logger = createLogger({ service: 'entity-identity' });

/**
 * Supported identity types
 */
export type IdentityType =
  | 'did' // Decentralized Identifier (W3C standard)
  | 'ens' // Ethereum Name Service style
  | 'nft' // NFT-based identity
  | 'soulbound' // Soulbound compliance token
  | 'custom';

/**
 * DID Document structure (simplified W3C DID Core)
 */
export interface DIDDocument {
  /** DID identifier (e.g., did:arka:entity:123) */
  id: string;
  /** Context for JSON-LD */
  '@context': string[];
  /** Verification methods */
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
  }>;
  /** Authentication methods */
  authentication?: string[];
  /** Service endpoints */
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  /** When the DID was created */
  created?: string;
  /** When the DID was last updated */
  updated?: string;
}

/**
 * Entity identity binding
 */
export interface EntityIdentityBinding {
  /** Unique binding ID */
  bindingId: string;
  /** ARKA entity ID */
  entityId: string;
  /** Entity type (Person, Organization, Asset, etc.) */
  entityType: string;
  /** Type of blockchain identity */
  identityType: IdentityType;
  /** The blockchain identity (DID, ENS name, NFT token ID, etc.) */
  blockchainIdentity: string;
  /** DID Document (if applicable) */
  didDocument?: DIDDocument;
  /** Hash of entity data at binding time */
  entityHash: string;
  /** When the binding was created */
  boundAt: string;
  /** Blockchain transaction info */
  blockchain?: {
    network: string;
    transactionHash: string;
    blockNumber: number;
    contractAddress?: string;
  };
  /** Binding status */
  status: 'active' | 'revoked' | 'expired';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Compliance attestation linked to entity
 */
export interface ComplianceAttestation {
  /** Attestation ID */
  attestationId: string;
  /** Entity binding it relates to */
  bindingId: string;
  /** Type of attestation */
  type: 'kyc' | 'aml' | 'accreditation' | 'license' | 'certification' | 'custom';
  /** Attestation status */
  status: 'valid' | 'expired' | 'revoked';
  /** Issuer of the attestation */
  issuer: string;
  /** When issued */
  issuedAt: string;
  /** When it expires */
  expiresAt?: string;
  /** Hash of attestation data */
  attestationHash: string;
  /** Blockchain proof */
  blockchain?: {
    network: string;
    transactionHash: string;
    blockNumber: number;
  };
}

/**
 * Query for entity bindings
 */
export interface EntityBindingQuery {
  /** Filter by entity ID */
  entityId?: string;
  /** Filter by entity type */
  entityType?: string;
  /** Filter by identity type */
  identityType?: IdentityType;
  /** Filter by blockchain identity */
  blockchainIdentity?: string;
  /** Only active bindings */
  activeOnly?: boolean;
}

/**
 * Computes hash of entity data
 */
function computeEntityHash(entity: ArkaEntity): string {
  const bytes = canonicalSerialize({
    id: entity.id,
    type: entity.type,
    data: entity.data,
  });
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Entity Identity Service
 *
 * Manages blockchain identity bindings for ARKA entities.
 */
export class EntityIdentityService {
  private adapter: BlockchainAdapter;
  private bindings: Map<string, EntityIdentityBinding> = new Map();
  private entityIdToBinding: Map<string, string> = new Map();
  private blockchainIdToBinding: Map<string, string> = new Map();
  private attestations: Map<string, ComplianceAttestation[]> = new Map();
  private didContractAddress?: string;

  constructor(adapter: BlockchainAdapter, didContractAddress?: string) {
    this.adapter = adapter;
    this.didContractAddress = didContractAddress;
  }

  /**
   * Creates a DID for an entity
   */
  createDID(entity: ArkaEntity, network: string = 'arka'): string {
    // Format: did:arka:entity:entityType:entityId
    return `did:${network}:entity:${entity.type.toLowerCase()}:${entity.id}`;
  }

  /**
   * Creates a DID Document for an entity
   */
  createDIDDocument(entity: ArkaEntity, network: string = 'arka'): DIDDocument {
    const did = this.createDID(entity, network);
    const now = new Date().toISOString();

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://pact.protocol/ns/v1',
      ],
      id: did,
      verificationMethod: [
        {
          id: `${did}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: did,
        },
      ],
      authentication: [`${did}#key-1`],
      service: [
        {
          id: `${did}#arka-compliance`,
          type: 'PACTComplianceService',
          serviceEndpoint: `https://api.pact.protocol/entities/${entity.id}`,
        },
      ],
      created: now,
      updated: now,
    };
  }

  /**
   * Binds an entity to a blockchain identity
   */
  async bindEntity(
    entity: ArkaEntity,
    identityType: IdentityType,
    blockchainIdentity?: string,
    metadata?: Record<string, unknown>
  ): Promise<EntityIdentityBinding> {
    // Check if entity already has a binding
    const existingBindingId = this.entityIdToBinding.get(entity.id);
    if (existingBindingId) {
      const existing = this.bindings.get(existingBindingId);
      if (existing && existing.status === 'active') {
        throw new Error(`Entity ${entity.id} already has an active binding`);
      }
    }

    const bindingId = ids.entity() + '_binding';
    const entityHash = computeEntityHash(entity);

    // Generate identity based on type
    let identity = blockchainIdentity;
    let didDocument: DIDDocument | undefined;

    if (!identity) {
      switch (identityType) {
        case 'did':
          identity = this.createDID(entity);
          didDocument = this.createDIDDocument(entity);
          break;
        case 'ens':
          identity = `${entity.id}.pact.eth`;
          break;
        case 'nft':
        case 'soulbound':
          identity = `pact:${entity.type}:${entity.id}`;
          break;
        default:
          identity = `custom:${entity.id}`;
      }
    } else if (identityType === 'did') {
      didDocument = this.createDIDDocument(entity);
    }

    const binding: EntityIdentityBinding = {
      bindingId,
      entityId: entity.id,
      entityType: entity.type,
      identityType,
      blockchainIdentity: identity,
      didDocument,
      entityHash,
      boundAt: new Date().toISOString(),
      status: 'active',
      metadata,
    };

    logger.info('Binding entity to blockchain identity', {
      bindingId,
      entityId: entity.id,
      identityType,
      blockchainIdentity: identity,
    });

    try {
      // Anchor binding to blockchain
      const result = await this.adapter.anchor({
        batchId: bindingId,
        merkleRoot: entityHash,
        recordCount: 1,
        metadata: {
          type: 'entity_identity_binding',
          bindingId,
          entityId: entity.id,
          entityType: entity.type,
          identityType,
          blockchainIdentity: identity,
          contractAddress: this.didContractAddress,
        },
      });

      binding.blockchain = {
        network: this.adapter.network,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        contractAddress: this.didContractAddress,
      };

      // Store binding
      this.bindings.set(bindingId, binding);
      this.entityIdToBinding.set(entity.id, bindingId);
      this.blockchainIdToBinding.set(identity, bindingId);

      logger.info('Entity bound to blockchain identity', {
        bindingId,
        transactionHash: result.transactionHash,
      });

      return binding;
    } catch (error) {
      logger.error('Failed to bind entity', error as Error, { bindingId });
      throw error;
    }
  }

  /**
   * Revokes an entity binding
   */
  async revokeBinding(bindingId: string): Promise<EntityIdentityBinding> {
    const binding = this.bindings.get(bindingId);
    if (!binding) {
      throw new Error(`Binding ${bindingId} not found`);
    }

    if (binding.status === 'revoked') {
      throw new Error(`Binding ${bindingId} is already revoked`);
    }

    binding.status = 'revoked';

    // Anchor revocation to blockchain
    await this.adapter.anchor({
      batchId: `${bindingId}_revoke`,
      merkleRoot: createHash('sha256')
        .update(`revoke:${bindingId}:${Date.now()}`)
        .digest('hex'),
      recordCount: 1,
      metadata: {
        type: 'entity_identity_revocation',
        bindingId,
        revokedAt: new Date().toISOString(),
      },
    });

    logger.info('Entity binding revoked', { bindingId });

    return binding;
  }

  /**
   * Resolves a blockchain identity to entity binding
   */
  resolveIdentity(blockchainIdentity: string): EntityIdentityBinding | undefined {
    const bindingId = this.blockchainIdToBinding.get(blockchainIdentity);
    if (!bindingId) return undefined;
    return this.bindings.get(bindingId);
  }

  /**
   * Gets binding for an entity
   */
  getEntityBinding(entityId: string): EntityIdentityBinding | undefined {
    const bindingId = this.entityIdToBinding.get(entityId);
    if (!bindingId) return undefined;
    return this.bindings.get(bindingId);
  }

  /**
   * Verifies entity data matches binding
   */
  async verifyEntity(entity: ArkaEntity): Promise<{
    verified: boolean;
    binding?: EntityIdentityBinding;
    hashMatches?: boolean;
    error?: string;
  }> {
    const binding = this.getEntityBinding(entity.id);

    if (!binding) {
      return {
        verified: false,
        error: 'No binding found for entity',
      };
    }

    if (binding.status !== 'active') {
      return {
        verified: false,
        binding,
        error: `Binding is ${binding.status}`,
      };
    }

    const currentHash = computeEntityHash(entity);
    const hashMatches = currentHash === binding.entityHash;

    if (!hashMatches) {
      return {
        verified: false,
        binding,
        hashMatches: false,
        error: 'Entity data has changed since binding',
      };
    }

    // Verify on blockchain
    if (binding.blockchain) {
      const blockchainResult = await this.adapter.verify(binding.entityHash);
      if (!blockchainResult.verified) {
        return {
          verified: false,
          binding,
          hashMatches: true,
          error: 'Binding not found on blockchain',
        };
      }
    }

    return {
      verified: true,
      binding,
      hashMatches: true,
    };
  }

  /**
   * Adds a compliance attestation to an entity
   */
  async addAttestation(
    bindingId: string,
    type: ComplianceAttestation['type'],
    issuer: string,
    attestationData: unknown,
    expiresAt?: string
  ): Promise<ComplianceAttestation> {
    const binding = this.bindings.get(bindingId);
    if (!binding) {
      throw new Error(`Binding ${bindingId} not found`);
    }

    const attestationId = ids.audit() + '_attest';
    const attestationHash = createHash('sha256')
      .update(canonicalSerialize(attestationData))
      .digest('hex');

    const attestation: ComplianceAttestation = {
      attestationId,
      bindingId,
      type,
      status: 'valid',
      issuer,
      issuedAt: new Date().toISOString(),
      expiresAt,
      attestationHash,
    };

    // Anchor to blockchain
    const result = await this.adapter.anchor({
      batchId: attestationId,
      merkleRoot: attestationHash,
      recordCount: 1,
      metadata: {
        type: 'compliance_attestation',
        attestationId,
        bindingId,
        attestationType: type,
        issuer,
      },
    });

    attestation.blockchain = {
      network: this.adapter.network,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
    };

    // Store attestation
    const existing = this.attestations.get(bindingId) ?? [];
    existing.push(attestation);
    this.attestations.set(bindingId, existing);

    logger.info('Compliance attestation added', {
      attestationId,
      bindingId,
      type,
      issuer,
    });

    return attestation;
  }

  /**
   * Gets attestations for a binding
   */
  getAttestations(bindingId: string): ComplianceAttestation[] {
    return this.attestations.get(bindingId) ?? [];
  }

  /**
   * Gets valid attestations for a binding
   */
  getValidAttestations(bindingId: string): ComplianceAttestation[] {
    const now = new Date().toISOString();
    return (this.attestations.get(bindingId) ?? []).filter((a) => {
      return a.status === 'valid' && (!a.expiresAt || a.expiresAt > now);
    });
  }

  /**
   * Queries bindings
   */
  query(query: EntityBindingQuery): EntityIdentityBinding[] {
    let results = Array.from(this.bindings.values());

    if (query.entityId) {
      results = results.filter((b) => b.entityId === query.entityId);
    }

    if (query.entityType) {
      results = results.filter((b) => b.entityType === query.entityType);
    }

    if (query.identityType) {
      results = results.filter((b) => b.identityType === query.identityType);
    }

    if (query.blockchainIdentity) {
      results = results.filter((b) => b.blockchainIdentity === query.blockchainIdentity);
    }

    if (query.activeOnly) {
      results = results.filter((b) => b.status === 'active');
    }

    return results;
  }

  /**
   * Gets all bindings
   */
  getAllBindings(): EntityIdentityBinding[] {
    return Array.from(this.bindings.values());
  }
}

/**
 * DID Registry Contract Interface (Solidity)
 *
 * ```solidity
 * // SPDX-License-Identifier: MIT
 * pragma solidity ^0.8.19;
 *
 * interface IPACTDIDRegistry {
 *     event DIDRegistered(
 *         bytes32 indexed entityId,
 *         string did,
 *         bytes32 entityHash,
 *         uint256 timestamp
 *     );
 *
 *     event DIDRevoked(bytes32 indexed entityId, uint256 timestamp);
 *
 *     event AttestationAdded(
 *         bytes32 indexed entityId,
 *         bytes32 indexed attestationId,
 *         string attestationType,
 *         address issuer
 *     );
 *
 *     function registerDID(
 *         bytes32 entityId,
 *         string calldata did,
 *         bytes32 entityHash,
 *         string calldata entityType
 *     ) external;
 *
 *     function revokeDID(bytes32 entityId) external;
 *
 *     function resolveDID(string calldata did) external view returns (
 *         bytes32 entityId,
 *         bytes32 entityHash,
 *         string memory entityType,
 *         bool active,
 *         uint256 registeredAt
 *     );
 *
 *     function addAttestation(
 *         bytes32 entityId,
 *         bytes32 attestationId,
 *         string calldata attestationType,
 *         bytes32 attestationHash,
 *         uint256 expiresAt
 *     ) external;
 *
 *     function getAttestations(bytes32 entityId) external view returns (
 *         bytes32[] memory attestationIds,
 *         string[] memory types,
 *         bool[] memory valid
 *     );
 * }
 * ```
 */
export const DID_REGISTRY_CONTRACT_ABI = [
  {
    type: 'event',
    name: 'DIDRegistered',
    inputs: [
      { name: 'entityId', type: 'bytes32', indexed: true },
      { name: 'did', type: 'string', indexed: false },
      { name: 'entityHash', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DIDRevoked',
    inputs: [
      { name: 'entityId', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'registerDID',
    inputs: [
      { name: 'entityId', type: 'bytes32' },
      { name: 'did', type: 'string' },
      { name: 'entityHash', type: 'bytes32' },
      { name: 'entityType', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveDID',
    inputs: [{ name: 'did', type: 'string' }],
    outputs: [
      { name: 'entityId', type: 'bytes32' },
      { name: 'entityHash', type: 'bytes32' },
      { name: 'entityType', type: 'string' },
      { name: 'active', type: 'bool' },
      { name: 'registeredAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
];
