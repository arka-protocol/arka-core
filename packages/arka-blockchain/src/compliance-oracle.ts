/**
 * Compliance Oracle Module
 *
 * A new category of oracle: "Compliance Oracle"
 *
 * Features:
 * - Proves off-chain events happened
 * - Verifies signed payloads
 * - Maps real-world events → on-chain compliance events
 * - Fraud-resistant bridge between real events, ARKA Core, and blockchain
 */

import { createHash, createVerify, createSign } from 'crypto';
import { canonicalSerialize } from '@arka/crypto';
import { createLogger, ids } from '@arka/utils';
import type { ArkaEvent } from '@arka/types';
import type { BlockchainAdapter } from './types.js';

const logger = createLogger({ service: 'compliance-oracle' });

/**
 * Oracle data source types
 */
export type OracleSourceType =
  | 'government_api' // Official government data
  | 'financial_institution' // Banks, exchanges
  | 'regulatory_body' // SEC, FDA, etc.
  | 'notary' // Digital notary service
  | 'iot_device' // IoT sensor data
  | 'attestation_service' // Third-party attestation
  | 'pact_node' // Another ARKA node
  | 'custom';

/**
 * Signature algorithm types
 */
export type SignatureAlgorithm = 'RSA-SHA256' | 'ECDSA-P256' | 'Ed25519';

/**
 * An off-chain event to be verified
 */
export interface OffChainEvent {
  /** Unique event ID */
  eventId: string;
  /** Type of event */
  eventType: string;
  /** Source of the event */
  source: {
    type: OracleSourceType;
    id: string;
    name: string;
    publicKey?: string;
  };
  /** Event payload */
  payload: unknown;
  /** Timestamp of the event */
  timestamp: string;
  /** Signature of the payload (if signed) */
  signature?: {
    algorithm: SignatureAlgorithm;
    value: string;
    signedFields: string[];
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Verification result for an off-chain event
 */
export interface OracleVerificationResult {
  /** Is the event verified */
  verified: boolean;
  /** Verification details */
  details: {
    signatureValid?: boolean;
    timestampValid?: boolean;
    sourceAuthorized?: boolean;
    payloadIntact?: boolean;
  };
  /** Confidence score (0-100) */
  confidence: number;
  /** Any errors */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

/**
 * Oracle attestation - proof that oracle verified an event
 */
export interface OracleAttestation {
  /** Attestation ID */
  attestationId: string;
  /** Original event ID */
  eventId: string;
  /** Hash of the verified event */
  eventHash: string;
  /** Oracle node that verified */
  oracleNode: string;
  /** Verification result */
  verification: OracleVerificationResult;
  /** When verified */
  verifiedAt: string;
  /** Oracle's signature */
  oracleSignature: string;
  /** Blockchain proof */
  blockchain?: {
    network: string;
    transactionHash: string;
    blockNumber: number;
  };
}

/**
 * Registered oracle source
 */
export interface RegisteredSource {
  /** Source ID */
  id: string;
  /** Source type */
  type: OracleSourceType;
  /** Source name */
  name: string;
  /** Public key for signature verification */
  publicKey: string;
  /** Allowed event types */
  allowedEventTypes: string[];
  /** Trust level (0-100) */
  trustLevel: number;
  /** Is active */
  active: boolean;
  /** Registration timestamp */
  registeredAt: string;
}

/**
 * Compliance Oracle Service
 *
 * Bridges real-world events to blockchain-verified compliance events.
 */
export class ComplianceOracleService {
  private adapter: BlockchainAdapter;
  private oracleNodeId: string;
  private oraclePrivateKey?: string;
  private registeredSources: Map<string, RegisteredSource> = new Map();
  private attestations: Map<string, OracleAttestation> = new Map();
  private pendingEvents: Map<string, OffChainEvent> = new Map();

  constructor(
    adapter: BlockchainAdapter,
    oracleNodeId: string,
    oraclePrivateKey?: string
  ) {
    this.adapter = adapter;
    this.oracleNodeId = oracleNodeId;
    this.oraclePrivateKey = oraclePrivateKey;
  }

  /**
   * Registers a trusted data source
   */
  registerSource(source: Omit<RegisteredSource, 'registeredAt'>): RegisteredSource {
    const registeredSource: RegisteredSource = {
      ...source,
      registeredAt: new Date().toISOString(),
    };

    this.registeredSources.set(source.id, registeredSource);

    logger.info('Registered oracle source', {
      sourceId: source.id,
      type: source.type,
      trustLevel: source.trustLevel,
    });

    return registeredSource;
  }

  /**
   * Removes a trusted data source
   */
  deregisterSource(sourceId: string): void {
    const source = this.registeredSources.get(sourceId);
    if (source) {
      source.active = false;
      logger.info('Deregistered oracle source', { sourceId });
    }
  }

  /**
   * Verifies an off-chain event
   */
  async verifyEvent(event: OffChainEvent): Promise<OracleVerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 100;

    // Check if source is registered
    const source = this.registeredSources.get(event.source.id);
    const sourceAuthorized = source?.active ?? false;

    if (!sourceAuthorized) {
      errors.push(`Source ${event.source.id} is not authorized`);
      confidence -= 50;
    }

    // Check event type is allowed for source
    if (source && !source.allowedEventTypes.includes(event.eventType)) {
      errors.push(`Event type ${event.eventType} not allowed for source ${event.source.id}`);
      confidence -= 30;
    }

    // Verify signature if present
    let signatureValid: boolean | undefined;
    if (event.signature) {
      const publicKey = source?.publicKey ?? event.source.publicKey;
      if (publicKey) {
        signatureValid = this.verifySignature(event, publicKey);
        if (!signatureValid) {
          errors.push('Invalid signature');
          confidence -= 40;
        }
      } else {
        warnings.push('No public key available for signature verification');
        confidence -= 20;
      }
    } else {
      warnings.push('Event is not signed');
      confidence -= 10;
    }

    // Check timestamp validity
    const now = Date.now();
    const eventTime = new Date(event.timestamp).getTime();
    const timestampValid = Math.abs(now - eventTime) < 24 * 60 * 60 * 1000; // Within 24 hours

    if (!timestampValid) {
      warnings.push('Event timestamp is more than 24 hours old');
      confidence -= 15;
    }

    // Check payload integrity
    const payloadIntact = this.verifyPayloadIntegrity(event);
    if (!payloadIntact) {
      errors.push('Payload integrity check failed');
      confidence -= 30;
    }

    // Adjust confidence based on source trust level
    if (source) {
      confidence = Math.min(confidence, source.trustLevel);
    }

    // Ensure confidence is within bounds
    confidence = Math.max(0, Math.min(100, confidence));

    return {
      verified: errors.length === 0 && confidence >= 50,
      details: {
        signatureValid,
        timestampValid,
        sourceAuthorized,
        payloadIntact,
      },
      confidence,
      errors,
      warnings,
    };
  }

  /**
   * Attests to an off-chain event and anchors to blockchain
   */
  async attestEvent(event: OffChainEvent): Promise<OracleAttestation> {
    // First verify the event
    const verification = await this.verifyEvent(event);

    if (!verification.verified) {
      throw new Error(`Event verification failed: ${verification.errors.join(', ')}`);
    }

    const attestationId = ids.audit() + '_oracle';
    const eventHash = createHash('sha256')
      .update(canonicalSerialize(event))
      .digest('hex');

    // Create oracle signature
    const oracleSignature = this.signAttestation(attestationId, eventHash, verification);

    const attestation: OracleAttestation = {
      attestationId,
      eventId: event.eventId,
      eventHash,
      oracleNode: this.oracleNodeId,
      verification,
      verifiedAt: new Date().toISOString(),
      oracleSignature,
    };

    logger.info('Creating oracle attestation', {
      attestationId,
      eventId: event.eventId,
      confidence: verification.confidence,
    });

    try {
      // Anchor to blockchain
      const result = await this.adapter.anchor({
        batchId: attestationId,
        merkleRoot: eventHash,
        recordCount: 1,
        metadata: {
          type: 'oracle_attestation',
          attestationId,
          eventId: event.eventId,
          oracleNode: this.oracleNodeId,
          confidence: verification.confidence,
          sourceType: event.source.type,
        },
      });

      attestation.blockchain = {
        network: this.adapter.network,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
      };

      // Store attestation
      this.attestations.set(attestationId, attestation);

      logger.info('Oracle attestation created', {
        attestationId,
        transactionHash: result.transactionHash,
      });

      return attestation;
    } catch (error) {
      logger.error('Failed to create oracle attestation', error as Error, {
        attestationId,
      });
      throw error;
    }
  }

  /**
   * Converts an off-chain event to ARKA canonical event
   */
  async bridgeToComplianceEvent(
    event: OffChainEvent,
    entityType: string,
    jurisdiction?: string
  ): Promise<{ pactEvent: Partial<ArkaEvent>; attestation: OracleAttestation }> {
    // First attest the event
    const attestation = await this.attestEvent(event);

    // Convert to ARKA event format
    const pactEvent: Partial<ArkaEvent> = {
      source: `oracle:${event.source.type}:${event.source.id}`,
      type: event.eventType,
      entityType,
      jurisdiction,
      payload: {
        ...event.payload as Record<string, unknown>,
        _oracle: {
          attestationId: attestation.attestationId,
          eventHash: attestation.eventHash,
          confidence: attestation.verification.confidence,
          blockchain: attestation.blockchain,
        },
      },
      occurredAt: event.timestamp,
    };

    logger.info('Bridged off-chain event to ARKA', {
      eventId: event.eventId,
      pactEventType: pactEvent.type,
      attestationId: attestation.attestationId,
    });

    return { pactEvent, attestation };
  }

  /**
   * Gets attestation by ID
   */
  getAttestation(attestationId: string): OracleAttestation | undefined {
    return this.attestations.get(attestationId);
  }

  /**
   * Verifies an attestation on blockchain
   */
  async verifyAttestation(attestationId: string): Promise<{
    verified: boolean;
    attestation?: OracleAttestation;
    error?: string;
  }> {
    const attestation = this.attestations.get(attestationId);

    if (!attestation) {
      return {
        verified: false,
        error: 'Attestation not found',
      };
    }

    if (!attestation.blockchain) {
      return {
        verified: false,
        attestation,
        error: 'Attestation not anchored to blockchain',
      };
    }

    try {
      const result = await this.adapter.verify(attestation.eventHash);
      return {
        verified: result.verified,
        attestation,
        error: result.verified ? undefined : 'Not found on blockchain',
      };
    } catch (error) {
      return {
        verified: false,
        attestation,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Gets all registered sources
   */
  getRegisteredSources(): RegisteredSource[] {
    return Array.from(this.registeredSources.values());
  }

  /**
   * Gets active sources of a type
   */
  getSourcesByType(type: OracleSourceType): RegisteredSource[] {
    return Array.from(this.registeredSources.values()).filter(
      (s) => s.type === type && s.active
    );
  }

  /**
   * Verifies signature on an event
   */
  private verifySignature(event: OffChainEvent, publicKey: string): boolean {
    if (!event.signature) return false;

    try {
      // Build signed data from signed fields
      const signedData: Record<string, unknown> = {};
      for (const field of event.signature.signedFields) {
        const value = this.getNestedValue(event, field);
        if (value !== undefined) {
          signedData[field] = value;
        }
      }

      const dataToVerify = canonicalSerialize(signedData);
      const verify = createVerify(event.signature.algorithm.replace('-', ''));
      verify.update(dataToVerify);

      return verify.verify(
        publicKey,
        Buffer.from(event.signature.value, 'base64')
      );
    } catch (error) {
      logger.error('Signature verification error', error as Error);
      return false;
    }
  }

  /**
   * Verifies payload integrity
   */
  private verifyPayloadIntegrity(event: OffChainEvent): boolean {
    // Basic integrity checks
    if (!event.payload) return false;
    if (!event.eventId) return false;
    if (!event.timestamp) return false;

    // Check timestamp is valid ISO format
    const timestamp = new Date(event.timestamp);
    if (isNaN(timestamp.getTime())) return false;

    return true;
  }

  /**
   * Signs an attestation
   */
  private signAttestation(
    attestationId: string,
    eventHash: string,
    verification: OracleVerificationResult
  ): string {
    const data = canonicalSerialize({
      attestationId,
      eventHash,
      confidence: verification.confidence,
      oracleNode: this.oracleNodeId,
      timestamp: Date.now(),
    });

    if (this.oraclePrivateKey) {
      const sign = createSign('RSA-SHA256');
      sign.update(data);
      return sign.sign(this.oraclePrivateKey, 'base64');
    }

    // If no private key, just return a hash as placeholder
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Gets nested value from object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}

/**
 * Compliance Oracle Contract Interface (Solidity)
 *
 * ```solidity
 * // SPDX-License-Identifier: MIT
 * pragma solidity ^0.8.19;
 *
 * interface IPACTComplianceOracle {
 *     event SourceRegistered(bytes32 indexed sourceId, string sourceType);
 *     event EventAttested(
 *         bytes32 indexed attestationId,
 *         bytes32 indexed eventHash,
 *         bytes32 indexed sourceId,
 *         uint256 confidence
 *     );
 *
 *     function registerSource(
 *         bytes32 sourceId,
 *         string calldata sourceType,
 *         bytes calldata publicKey,
 *         uint8 trustLevel
 *     ) external;
 *
 *     function attestEvent(
 *         bytes32 attestationId,
 *         bytes32 eventId,
 *         bytes32 eventHash,
 *         bytes32 sourceId,
 *         uint8 confidence,
 *         bytes calldata oracleSignature
 *     ) external;
 *
 *     function verifyAttestation(bytes32 attestationId) external view returns (
 *         bool exists,
 *         bytes32 eventHash,
 *         uint8 confidence,
 *         uint256 timestamp
 *     );
 *
 *     function getSourceTrustLevel(bytes32 sourceId) external view returns (uint8);
 * }
 * ```
 */
export const COMPLIANCE_ORACLE_CONTRACT_ABI = [
  {
    type: 'event',
    name: 'SourceRegistered',
    inputs: [
      { name: 'sourceId', type: 'bytes32', indexed: true },
      { name: 'sourceType', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EventAttested',
    inputs: [
      { name: 'attestationId', type: 'bytes32', indexed: true },
      { name: 'eventHash', type: 'bytes32', indexed: true },
      { name: 'sourceId', type: 'bytes32', indexed: true },
      { name: 'confidence', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'attestEvent',
    inputs: [
      { name: 'attestationId', type: 'bytes32' },
      { name: 'eventId', type: 'bytes32' },
      { name: 'eventHash', type: 'bytes32' },
      { name: 'sourceId', type: 'bytes32' },
      { name: 'confidence', type: 'uint8' },
      { name: 'oracleSignature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'verifyAttestation',
    inputs: [{ name: 'attestationId', type: 'bytes32' }],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'eventHash', type: 'bytes32' },
      { name: 'confidence', type: 'uint8' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
];
