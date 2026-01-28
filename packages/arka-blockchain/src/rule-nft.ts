/**
 * On-Chain Rule NFTs (Versioned Rule Registry)
 *
 * Each rule version becomes a soulbound NFT containing:
 * - Rule ID
 * - Version
 * - Jurisdiction
 * - DSL
 * - Activation date
 *
 * ARKA Core loads rules from DB but verifies integrity against blockchain.
 *
 * Benefits:
 * - Regulatory transparency
 * - Cross-border trust
 * - Instant standardization
 */

import { createHash } from 'crypto';
import { canonicalSerialize, canonicalStringify } from '@arka/crypto';
import { createLogger, ids } from '@arka/utils';
import type { ArkaRule, ArkaCondition, ArkaConsequence } from '@arka/types';
import type { BlockchainAdapter, AnchoredRecord } from './types.js';

const logger = createLogger({ service: 'rule-nft' });

/**
 * Rule NFT metadata stored on-chain
 */
export interface RuleNFTMetadata {
  /** Unique token ID */
  tokenId: string;
  /** Rule ID in ARKA system */
  ruleId: string;
  /** Rule version */
  version: number;
  /** Rule name */
  name: string;
  /** Jurisdiction code */
  jurisdiction?: string;
  /** Hash of the full rule DSL */
  dslHash: string;
  /** Activation date */
  activationDate: string;
  /** Expiration date (if any) */
  expirationDate?: string;
  /** Severity level */
  severity: string;
  /** Creator/issuer */
  issuer: string;
  /** Timestamp of minting */
  mintedAt: string;
  /** Is this a soulbound token (non-transferable) */
  soulbound: boolean;
}

/**
 * Full rule NFT with on-chain reference
 */
export interface RuleNFT {
  /** NFT metadata */
  metadata: RuleNFTMetadata;
  /** Full rule DSL (stored off-chain, verified by hash) */
  rule: ArkaRule;
  /** Blockchain transaction info */
  blockchain?: {
    network: string;
    contractAddress: string;
    transactionHash: string;
    blockNumber: number;
  };
}

/**
 * Rule verification result
 */
export interface RuleVerificationResult {
  /** Is the rule verified */
  verified: boolean;
  /** Rule NFT details */
  ruleNFT?: RuleNFT;
  /** Does local rule match on-chain hash */
  hashMatches?: boolean;
  /** Is rule active (within activation/expiration) */
  isActive?: boolean;
  /** Error if verification failed */
  error?: string;
}

/**
 * Query for rule NFTs
 */
export interface RuleNFTQuery {
  /** Filter by rule ID */
  ruleId?: string;
  /** Filter by jurisdiction */
  jurisdiction?: string;
  /** Filter by version */
  version?: number;
  /** Only active rules */
  activeOnly?: boolean;
  /** Filter by issuer */
  issuer?: string;
}

/**
 * Computes hash of a rule's DSL
 */
function computeRuleDSLHash(rule: ArkaRule): string {
  // Hash only the immutable parts of the rule
  const dslData = {
    name: rule.name,
    description: rule.description,
    jurisdiction: rule.jurisdiction,
    condition: rule.condition,
    consequence: rule.consequence,
    severity: rule.severity,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
  };
  const bytes = canonicalSerialize(dslData);
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Rule NFT Registry Service
 *
 * Manages on-chain rule NFTs for ARKA Protocol.
 */
export class RuleNFTRegistry {
  private adapter: BlockchainAdapter;
  private contractAddress: string;
  private issuer: string;
  private ruleNFTs: Map<string, RuleNFT> = new Map();
  private ruleIdToTokenId: Map<string, string[]> = new Map();

  constructor(adapter: BlockchainAdapter, contractAddress: string, issuer: string) {
    this.adapter = adapter;
    this.contractAddress = contractAddress;
    this.issuer = issuer;
  }

  /**
   * Mints a new Rule NFT on-chain
   */
  async mintRuleNFT(rule: ArkaRule, version: number = 1): Promise<RuleNFT> {
    const tokenId = `rule_${rule.id}_v${version}_${Date.now().toString(36)}`;
    const dslHash = computeRuleDSLHash(rule);

    const metadata: RuleNFTMetadata = {
      tokenId,
      ruleId: rule.id,
      version,
      name: rule.name,
      jurisdiction: rule.jurisdiction ?? undefined,
      dslHash,
      activationDate: rule.effectiveFrom ?? new Date().toISOString(),
      expirationDate: rule.effectiveTo ?? undefined,
      severity: rule.severity,
      issuer: this.issuer,
      mintedAt: new Date().toISOString(),
      soulbound: true, // Rules are soulbound by default
    };

    logger.info('Minting Rule NFT', {
      tokenId,
      ruleId: rule.id,
      version,
      jurisdiction: rule.jurisdiction,
    });

    try {
      // Anchor to blockchain
      const result = await this.adapter.anchor({
        batchId: tokenId,
        merkleRoot: dslHash,
        recordCount: 1,
        metadata: {
          type: 'rule_nft',
          tokenId,
          ruleId: rule.id,
          version,
          jurisdiction: rule.jurisdiction,
          severity: rule.severity,
          activationDate: metadata.activationDate,
          contractAddress: this.contractAddress,
        },
      });

      const ruleNFT: RuleNFT = {
        metadata,
        rule,
        blockchain: {
          network: this.adapter.network,
          contractAddress: this.contractAddress,
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber,
        },
      };

      // Store locally
      this.ruleNFTs.set(tokenId, ruleNFT);
      const existingTokens = this.ruleIdToTokenId.get(rule.id) ?? [];
      existingTokens.push(tokenId);
      this.ruleIdToTokenId.set(rule.id, existingTokens);

      logger.info('Rule NFT minted', {
        tokenId,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
      });

      return ruleNFT;
    } catch (error) {
      logger.error('Failed to mint Rule NFT', error as Error, { tokenId });
      throw error;
    }
  }

  /**
   * Verifies a rule against its on-chain NFT
   */
  async verifyRule(rule: ArkaRule): Promise<RuleVerificationResult> {
    const tokenIds = this.ruleIdToTokenId.get(rule.id);

    if (!tokenIds || tokenIds.length === 0) {
      return {
        verified: false,
        error: 'No NFT found for this rule',
      };
    }

    // Get the latest version
    const latestTokenId = tokenIds[tokenIds.length - 1]!;
    const ruleNFT = this.ruleNFTs.get(latestTokenId);

    if (!ruleNFT) {
      return {
        verified: false,
        error: 'Rule NFT not found locally',
      };
    }

    // Verify hash matches
    const computedHash = computeRuleDSLHash(rule);
    const hashMatches = computedHash === ruleNFT.metadata.dslHash;

    if (!hashMatches) {
      return {
        verified: false,
        ruleNFT,
        hashMatches: false,
        error: 'Rule DSL has been modified - hash mismatch',
      };
    }

    // Check if rule is active
    const now = new Date().toISOString();
    const isActive =
      ruleNFT.metadata.activationDate <= now &&
      (!ruleNFT.metadata.expirationDate || ruleNFT.metadata.expirationDate > now);

    // Verify on blockchain
    if (ruleNFT.blockchain) {
      try {
        const blockchainResult = await this.adapter.verify(ruleNFT.metadata.dslHash);
        if (!blockchainResult.verified) {
          return {
            verified: false,
            ruleNFT,
            hashMatches: true,
            isActive,
            error: 'Rule not found on blockchain',
          };
        }
      } catch (error) {
        return {
          verified: false,
          ruleNFT,
          hashMatches: true,
          isActive,
          error: `Blockchain verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    return {
      verified: true,
      ruleNFT,
      hashMatches: true,
      isActive,
    };
  }

  /**
   * Gets all versions of a rule
   */
  getRuleVersions(ruleId: string): RuleNFT[] {
    const tokenIds = this.ruleIdToTokenId.get(ruleId) ?? [];
    return tokenIds.map((id) => this.ruleNFTs.get(id)!).filter(Boolean);
  }

  /**
   * Gets the latest version of a rule NFT
   */
  getLatestVersion(ruleId: string): RuleNFT | undefined {
    const tokenIds = this.ruleIdToTokenId.get(ruleId);
    if (!tokenIds || tokenIds.length === 0) return undefined;
    return this.ruleNFTs.get(tokenIds[tokenIds.length - 1]!);
  }

  /**
   * Gets a specific rule NFT by token ID
   */
  getRuleNFT(tokenId: string): RuleNFT | undefined {
    return this.ruleNFTs.get(tokenId);
  }

  /**
   * Queries rule NFTs
   */
  query(query: RuleNFTQuery): RuleNFT[] {
    let results = Array.from(this.ruleNFTs.values());

    if (query.ruleId) {
      results = results.filter((nft) => nft.metadata.ruleId === query.ruleId);
    }

    if (query.jurisdiction) {
      results = results.filter((nft) => nft.metadata.jurisdiction === query.jurisdiction);
    }

    if (query.version !== undefined) {
      results = results.filter((nft) => nft.metadata.version === query.version);
    }

    if (query.issuer) {
      results = results.filter((nft) => nft.metadata.issuer === query.issuer);
    }

    if (query.activeOnly) {
      const now = new Date().toISOString();
      results = results.filter((nft) => {
        return (
          nft.metadata.activationDate <= now &&
          (!nft.metadata.expirationDate || nft.metadata.expirationDate > now)
        );
      });
    }

    return results;
  }

  /**
   * Gets all rule NFTs
   */
  getAllRuleNFTs(): RuleNFT[] {
    return Array.from(this.ruleNFTs.values());
  }

  /**
   * Exports rule NFTs for regulatory transparency
   */
  exportForRegulators(jurisdiction?: string): {
    exportedAt: string;
    jurisdiction?: string;
    totalRules: number;
    rules: Array<{
      ruleId: string;
      name: string;
      version: number;
      dslHash: string;
      activationDate: string;
      severity: string;
      blockchainProof?: {
        network: string;
        transactionHash: string;
        blockNumber: number;
      };
    }>;
  } {
    let rules = this.getAllRuleNFTs();

    if (jurisdiction) {
      rules = rules.filter((r) => r.metadata.jurisdiction === jurisdiction);
    }

    return {
      exportedAt: new Date().toISOString(),
      jurisdiction,
      totalRules: rules.length,
      rules: rules.map((r) => ({
        ruleId: r.metadata.ruleId,
        name: r.metadata.name,
        version: r.metadata.version,
        dslHash: r.metadata.dslHash,
        activationDate: r.metadata.activationDate,
        severity: r.metadata.severity,
        blockchainProof: r.blockchain
          ? {
              network: r.blockchain.network,
              transactionHash: r.blockchain.transactionHash,
              blockNumber: r.blockchain.blockNumber,
            }
          : undefined,
      })),
    };
  }
}

/**
 * ERC-721 compatible Rule NFT Contract Interface (Solidity)
 *
 * ```solidity
 * // SPDX-License-Identifier: MIT
 * pragma solidity ^0.8.19;
 *
 * import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
 * import "@openzeppelin/contracts/access/Ownable.sol";
 *
 * contract ARKARuleNFT is ERC721, Ownable {
 *     struct RuleMetadata {
 *         bytes32 ruleId;
 *         uint256 version;
 *         string jurisdiction;
 *         bytes32 dslHash;
 *         uint256 activationDate;
 *         uint256 expirationDate;
 *         string severity;
 *         bool soulbound;
 *     }
 *
 *     mapping(uint256 => RuleMetadata) public ruleMetadata;
 *     mapping(bytes32 => uint256[]) public ruleVersions;
 *
 *     event RuleMinted(
 *         uint256 indexed tokenId,
 *         bytes32 indexed ruleId,
 *         uint256 version,
 *         bytes32 dslHash
 *     );
 *
 *     constructor() ERC721("ARKA Rule NFT", "PACTRULE") {}
 *
 *     function mintRule(
 *         bytes32 ruleId,
 *         uint256 version,
 *         string calldata jurisdiction,
 *         bytes32 dslHash,
 *         uint256 activationDate,
 *         uint256 expirationDate,
 *         string calldata severity
 *     ) external onlyOwner returns (uint256) {
 *         uint256 tokenId = uint256(keccak256(abi.encodePacked(ruleId, version)));
 *
 *         _mint(msg.sender, tokenId);
 *
 *         ruleMetadata[tokenId] = RuleMetadata({
 *             ruleId: ruleId,
 *             version: version,
 *             jurisdiction: jurisdiction,
 *             dslHash: dslHash,
 *             activationDate: activationDate,
 *             expirationDate: expirationDate,
 *             severity: severity,
 *             soulbound: true
 *         });
 *
 *         ruleVersions[ruleId].push(tokenId);
 *
 *         emit RuleMinted(tokenId, ruleId, version, dslHash);
 *
 *         return tokenId;
 *     }
 *
 *     function verifyRule(bytes32 dslHash) external view returns (bool exists) {
 *         // Implementation to verify hash exists
 *     }
 *
 *     // Override transfer to make soulbound
 *     function _beforeTokenTransfer(
 *         address from,
 *         address to,
 *         uint256 tokenId
 *     ) internal virtual override {
 *         require(from == address(0), "Soulbound: non-transferable");
 *         super._beforeTokenTransfer(from, to, tokenId);
 *     }
 * }
 * ```
 */
export const RULE_NFT_CONTRACT_ABI = [
  {
    type: 'event',
    name: 'RuleMinted',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'ruleId', type: 'bytes32', indexed: true },
      { name: 'version', type: 'uint256', indexed: false },
      { name: 'dslHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'mintRule',
    inputs: [
      { name: 'ruleId', type: 'bytes32' },
      { name: 'version', type: 'uint256' },
      { name: 'jurisdiction', type: 'string' },
      { name: 'dslHash', type: 'bytes32' },
      { name: 'activationDate', type: 'uint256' },
      { name: 'expirationDate', type: 'uint256' },
      { name: 'severity', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'verifyRule',
    inputs: [{ name: 'dslHash', type: 'bytes32' }],
    outputs: [{ name: 'exists', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRuleMetadata',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'ruleId', type: 'bytes32' },
      { name: 'version', type: 'uint256' },
      { name: 'jurisdiction', type: 'string' },
      { name: 'dslHash', type: 'bytes32' },
      { name: 'activationDate', type: 'uint256' },
      { name: 'expirationDate', type: 'uint256' },
      { name: 'severity', type: 'string' },
      { name: 'soulbound', type: 'bool' },
    ],
    stateMutability: 'view',
  },
];
