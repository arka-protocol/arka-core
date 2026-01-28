/**
 * Append-Only Event Log
 *
 * Immutable event sourcing implementation for ARKA Protocol.
 * All state changes are recorded as events that can be replayed.
 */

import { createHash } from 'crypto';
import { canonicalSerialize } from './canonical.js';
import { getMerkleRoot, generateMerkleProof, type MerkleProof } from './merkle.js';

/**
 * Types of events in the ARKA event log
 */
export type PactLogEventType =
  | 'RULE_CREATED'
  | 'RULE_UPDATED'
  | 'RULE_ACTIVATED'
  | 'RULE_DEACTIVATED'
  | 'ENTITY_TYPE_REGISTERED'
  | 'ENTITY_CREATED'
  | 'ENTITY_UPDATED'
  | 'EVENT_RECEIVED'
  | 'DECISION_MADE'
  | 'AUDIT_RECORDED'
  | 'PROPOSAL_CREATED'
  | 'PROPOSAL_APPROVED'
  | 'PROPOSAL_REJECTED'
  | 'BATCH_ANCHORED';

/**
 * A single entry in the append-only log
 */
export interface LogEntry<T = unknown> {
  /** Sequence number (monotonically increasing) */
  sequence: number;
  /** Type of event */
  type: PactLogEventType;
  /** Event payload */
  payload: T;
  /** Hash of the previous entry (chain link) */
  previousHash: string;
  /** Hash of this entry */
  hash: string;
  /** Timestamp of the event */
  timestamp: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State checkpoint for efficient reconstruction
 */
export interface StateCheckpoint {
  /** Sequence number at checkpoint */
  sequence: number;
  /** Merkle root of all entries up to this point */
  merkleRoot: string;
  /** Snapshot of current state */
  state: Record<string, unknown>;
  /** Timestamp of checkpoint */
  timestamp: string;
}

/**
 * Options for the event log
 */
export interface EventLogOptions {
  /** How often to create checkpoints (every N entries) */
  checkpointInterval?: number;
  /** Maximum entries to keep in memory */
  maxInMemory?: number;
  /** Callback when entry is appended */
  onAppend?: (entry: LogEntry) => void | Promise<void>;
  /** Callback when checkpoint is created */
  onCheckpoint?: (checkpoint: StateCheckpoint) => void | Promise<void>;
}

const GENESIS_HASH = '0'.repeat(64);

/**
 * Computes hash of a log entry
 */
function computeEntryHash(entry: Omit<LogEntry, 'hash'>): string {
  const data = {
    sequence: entry.sequence,
    type: entry.type,
    payload: entry.payload,
    previousHash: entry.previousHash,
    timestamp: entry.timestamp,
    metadata: entry.metadata,
  };
  return createHash('sha256').update(canonicalSerialize(data)).digest('hex');
}

/**
 * Append-only event log with cryptographic linking
 */
export class AppendOnlyEventLog {
  private entries: LogEntry[] = [];
  private checkpoints: StateCheckpoint[] = [];
  private options: Required<EventLogOptions>;

  constructor(options: EventLogOptions = {}) {
    this.options = {
      checkpointInterval: options.checkpointInterval ?? 1000,
      maxInMemory: options.maxInMemory ?? 10000,
      onAppend: options.onAppend ?? (() => {}),
      onCheckpoint: options.onCheckpoint ?? (() => {}),
    };
  }

  /**
   * Appends a new entry to the log
   */
  async append<T>(
    type: PactLogEventType,
    payload: T,
    metadata?: Record<string, unknown>
  ): Promise<LogEntry<T>> {
    const sequence = this.entries.length;
    const previousHash =
      sequence === 0 ? GENESIS_HASH : this.entries[sequence - 1]!.hash;

    const entryData = {
      sequence,
      type,
      payload,
      previousHash,
      timestamp: new Date().toISOString(),
      metadata,
    };

    const entry: LogEntry<T> = {
      ...entryData,
      hash: computeEntryHash(entryData),
    };

    this.entries.push(entry as LogEntry);

    // Trigger callback
    await this.options.onAppend(entry as LogEntry);

    // Create checkpoint if needed
    if (sequence > 0 && sequence % this.options.checkpointInterval === 0) {
      await this.createCheckpoint();
    }

    // Prune old entries if needed
    this.pruneIfNeeded();

    return entry;
  }

  /**
   * Gets an entry by sequence number
   */
  getEntry(sequence: number): LogEntry | undefined {
    return this.entries[sequence];
  }

  /**
   * Gets the latest entry
   */
  getLatest(): LogEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  /**
   * Gets entries in a range
   */
  getRange(start: number, end?: number): LogEntry[] {
    return this.entries.slice(start, end);
  }

  /**
   * Gets entries by type
   */
  getByType(type: PactLogEventType): LogEntry[] {
    return this.entries.filter((e) => e.type === type);
  }

  /**
   * Gets the current sequence number
   */
  getCurrentSequence(): number {
    return this.entries.length;
  }

  /**
   * Gets the current chain head hash
   */
  getHeadHash(): string {
    const latest = this.getLatest();
    return latest?.hash ?? GENESIS_HASH;
  }

  /**
   * Verifies chain integrity
   */
  verifyIntegrity(fromSequence: number = 0): {
    valid: boolean;
    errorAt?: number;
    error?: string;
  } {
    for (let i = fromSequence; i < this.entries.length; i++) {
      const entry = this.entries[i]!;

      // Verify hash
      const expectedHash = computeEntryHash({
        sequence: entry.sequence,
        type: entry.type,
        payload: entry.payload,
        previousHash: entry.previousHash,
        timestamp: entry.timestamp,
        metadata: entry.metadata,
      });

      if (entry.hash !== expectedHash) {
        return {
          valid: false,
          errorAt: i,
          error: `Hash mismatch at sequence ${i}`,
        };
      }

      // Verify chain link
      if (i > 0) {
        const previous = this.entries[i - 1]!;
        if (entry.previousHash !== previous.hash) {
          return {
            valid: false,
            errorAt: i,
            error: `Chain link broken at sequence ${i}`,
          };
        }
      } else if (entry.previousHash !== GENESIS_HASH) {
        return {
          valid: false,
          errorAt: 0,
          error: 'First entry does not link to genesis',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Generates a Merkle proof for a specific entry
   */
  generateProof(sequence: number): MerkleProof {
    const entries = this.entries.map((e) => e.hash);
    return generateMerkleProof(entries, sequence);
  }

  /**
   * Gets the Merkle root of all entries
   */
  getMerkleRoot(): string {
    if (this.entries.length === 0) {
      return GENESIS_HASH;
    }
    return getMerkleRoot(this.entries.map((e) => e.hash));
  }

  /**
   * Creates a state checkpoint
   */
  private async createCheckpoint(): Promise<StateCheckpoint> {
    const checkpoint: StateCheckpoint = {
      sequence: this.entries.length - 1,
      merkleRoot: this.getMerkleRoot(),
      state: this.computeCurrentState(),
      timestamp: new Date().toISOString(),
    };

    this.checkpoints.push(checkpoint);
    await this.options.onCheckpoint(checkpoint);

    return checkpoint;
  }

  /**
   * Computes current state from events (for checkpointing)
   */
  private computeCurrentState(): Record<string, unknown> {
    // This is a simplified state computation
    // In production, this would reconstruct full application state
    const ruleCount = this.entries.filter((e) =>
      ['RULE_CREATED', 'RULE_UPDATED'].includes(e.type)
    ).length;
    const decisionCount = this.entries.filter(
      (e) => e.type === 'DECISION_MADE'
    ).length;
    const entityCount = this.entries.filter(
      (e) => e.type === 'ENTITY_CREATED'
    ).length;

    return {
      ruleCount,
      decisionCount,
      entityCount,
      lastSequence: this.entries.length - 1,
      lastHash: this.getHeadHash(),
    };
  }

  /**
   * Gets the latest checkpoint
   */
  getLatestCheckpoint(): StateCheckpoint | undefined {
    return this.checkpoints[this.checkpoints.length - 1];
  }

  /**
   * Prunes old entries from memory (keeps them on disk in production)
   */
  private pruneIfNeeded(): void {
    if (this.entries.length > this.options.maxInMemory) {
      // In production, this would persist to storage before pruning
      // For now, we just keep a sliding window
      const toRemove = this.entries.length - this.options.maxInMemory;
      this.entries = this.entries.slice(toRemove);
    }
  }

  /**
   * Exports log entries for persistence
   */
  export(): { entries: LogEntry[]; checkpoints: StateCheckpoint[] } {
    return {
      entries: [...this.entries],
      checkpoints: [...this.checkpoints],
    };
  }

  /**
   * Imports log entries (for recovery)
   */
  import(data: { entries: LogEntry[]; checkpoints: StateCheckpoint[] }): void {
    // Verify integrity before importing
    const originalEntries = this.entries;
    this.entries = data.entries;

    const verification = this.verifyIntegrity();
    if (!verification.valid) {
      this.entries = originalEntries;
      throw new Error(`Invalid log data: ${verification.error}`);
    }

    this.checkpoints = data.checkpoints;
  }

  /**
   * Clears the log (for testing)
   */
  clear(): void {
    this.entries = [];
    this.checkpoints = [];
  }
}

// Global singleton
let globalEventLog: AppendOnlyEventLog | null = null;

export function getGlobalEventLog(): AppendOnlyEventLog {
  if (!globalEventLog) {
    globalEventLog = new AppendOnlyEventLog();
  }
  return globalEventLog;
}

export function resetGlobalEventLog(): void {
  globalEventLog?.clear();
  globalEventLog = null;
}
