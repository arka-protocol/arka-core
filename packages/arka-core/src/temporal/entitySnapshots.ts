/**
 * Temporal Entity Snapshots & Multi-Entity Joins
 *
 * Maintains point-in-time entity states and enables cross-entity
 * queries for compliance evaluation (Enhancement #16).
 */

import type { ArkaEntity } from '@arka/types';

/**
 * Entity snapshot at a point in time
 */
export interface EntitySnapshot {
  /** Snapshot identifier */
  id: string;

  /** Entity ID */
  entityId: string;

  /** Entity type */
  entityType: string;

  /** Snapshot timestamp */
  timestamp: string;

  /** Entity data at this point */
  data: Record<string, unknown>;

  /** Previous snapshot ID (for chaining) */
  previousSnapshotId?: string;

  /** Change reason */
  changeReason?: string;

  /** Actor who made the change */
  changedBy?: string;

  /** Hash of the data for integrity */
  dataHash: string;
}

/**
 * Entity relationship
 */
export interface EntityRelationship {
  /** Source entity ID */
  sourceEntityId: string;

  /** Target entity ID */
  targetEntityId: string;

  /** Relationship type */
  type: string;

  /** Relationship properties */
  properties?: Record<string, unknown>;

  /** When relationship was established */
  establishedAt: string;

  /** When relationship ended (if applicable) */
  endedAt?: string;
}

/**
 * Join query specification
 */
export interface EntityJoinQuery {
  /** Primary entity type */
  primaryEntityType: string;

  /** Primary entity filter */
  primaryFilter?: Record<string, unknown>;

  /** Joins to other entities */
  joins: Array<{
    /** Entity type to join */
    entityType: string;
    /** Relationship type to follow */
    relationshipType: string;
    /** Alias for joined entity */
    alias: string;
    /** Filter on joined entity */
    filter?: Record<string, unknown>;
  }>;

  /** Point in time for the query */
  asOf?: string;
}

/**
 * Join result
 */
export interface EntityJoinResult {
  /** Primary entity */
  primary: EntitySnapshot;

  /** Joined entities by alias */
  joined: Record<string, EntitySnapshot>;

  /** Relationships used */
  relationships: EntityRelationship[];
}

/**
 * Temporal storage interface
 */
export interface TemporalStorage {
  /** Store a snapshot */
  storeSnapshot(snapshot: EntitySnapshot): Promise<void>;

  /** Get snapshot by ID */
  getSnapshot(snapshotId: string): Promise<EntitySnapshot | null>;

  /** Get latest snapshot for entity */
  getLatestSnapshot(entityId: string): Promise<EntitySnapshot | null>;

  /** Get snapshot at specific time */
  getSnapshotAtTime(entityId: string, timestamp: string): Promise<EntitySnapshot | null>;

  /** Get all snapshots for entity */
  getSnapshotHistory(entityId: string, limit?: number): Promise<EntitySnapshot[]>;

  /** Store relationship */
  storeRelationship(relationship: EntityRelationship): Promise<void>;

  /** Get relationships for entity */
  getRelationships(
    entityId: string,
    type?: string,
    asOf?: string
  ): Promise<EntityRelationship[]>;

  /** Find entities matching criteria */
  findEntities(
    entityType: string,
    filter: Record<string, unknown>,
    asOf?: string
  ): Promise<EntitySnapshot[]>;
}

/**
 * In-memory temporal storage implementation
 */
export class InMemoryTemporalStorage implements TemporalStorage {
  private snapshots: Map<string, EntitySnapshot> = new Map();
  private entityIndex: Map<string, string[]> = new Map(); // entityId -> snapshotIds
  private relationships: EntityRelationship[] = [];

  async storeSnapshot(snapshot: EntitySnapshot): Promise<void> {
    this.snapshots.set(snapshot.id, snapshot);

    const existing = this.entityIndex.get(snapshot.entityId) ?? [];
    existing.push(snapshot.id);
    this.entityIndex.set(snapshot.entityId, existing);
  }

  async getSnapshot(snapshotId: string): Promise<EntitySnapshot | null> {
    return this.snapshots.get(snapshotId) ?? null;
  }

  async getLatestSnapshot(entityId: string): Promise<EntitySnapshot | null> {
    const snapshotIds = this.entityIndex.get(entityId);
    if (!snapshotIds || snapshotIds.length === 0) return null;

    const snapshots = snapshotIds
      .map((id) => this.snapshots.get(id)!)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return snapshots[0] ?? null;
  }

  async getSnapshotAtTime(entityId: string, timestamp: string): Promise<EntitySnapshot | null> {
    const snapshotIds = this.entityIndex.get(entityId);
    if (!snapshotIds) return null;

    const targetTime = new Date(timestamp).getTime();
    const snapshots = snapshotIds
      .map((id) => this.snapshots.get(id)!)
      .filter((s) => new Date(s.timestamp).getTime() <= targetTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return snapshots[0] ?? null;
  }

  async getSnapshotHistory(entityId: string, limit?: number): Promise<EntitySnapshot[]> {
    const snapshotIds = this.entityIndex.get(entityId) ?? [];
    let snapshots = snapshotIds
      .map((id) => this.snapshots.get(id)!)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (limit) {
      snapshots = snapshots.slice(0, limit);
    }

    return snapshots;
  }

  async storeRelationship(relationship: EntityRelationship): Promise<void> {
    this.relationships.push(relationship);
  }

  async getRelationships(
    entityId: string,
    type?: string,
    asOf?: string
  ): Promise<EntityRelationship[]> {
    let rels = this.relationships.filter(
      (r) => r.sourceEntityId === entityId || r.targetEntityId === entityId
    );

    if (type) {
      rels = rels.filter((r) => r.type === type);
    }

    if (asOf) {
      const targetTime = new Date(asOf).getTime();
      rels = rels.filter((r) => {
        const established = new Date(r.establishedAt).getTime();
        const ended = r.endedAt ? new Date(r.endedAt).getTime() : Infinity;
        return established <= targetTime && targetTime < ended;
      });
    }

    return rels;
  }

  async findEntities(
    entityType: string,
    filter: Record<string, unknown>,
    asOf?: string
  ): Promise<EntitySnapshot[]> {
    const results: EntitySnapshot[] = [];

    for (const entityId of this.entityIndex.keys()) {
      const snapshot = asOf
        ? await this.getSnapshotAtTime(entityId, asOf)
        : await this.getLatestSnapshot(entityId);

      if (!snapshot || snapshot.entityType !== entityType) continue;

      // Check filter
      let matches = true;
      for (const [key, value] of Object.entries(filter)) {
        if (snapshot.data[key] !== value) {
          matches = false;
          break;
        }
      }

      if (matches) {
        results.push(snapshot);
      }
    }

    return results;
  }
}

/**
 * Temporal Entity Manager
 */
export class TemporalEntityManager {
  private storage: TemporalStorage;

  constructor(storage?: TemporalStorage) {
    this.storage = storage ?? new InMemoryTemporalStorage();
  }

  /**
   * Create a snapshot from an entity
   */
  async createSnapshot(
    entity: ArkaEntity,
    changeReason?: string,
    changedBy?: string
  ): Promise<EntitySnapshot> {
    const previousSnapshot = await this.storage.getLatestSnapshot(entity.id);

    const snapshot: EntitySnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityId: entity.id,
      entityType: entity.type,
      timestamp: new Date().toISOString(),
      data: entity.data,
      previousSnapshotId: previousSnapshot?.id,
      changeReason,
      changedBy,
      dataHash: this.hashData(entity.data),
    };

    await this.storage.storeSnapshot(snapshot);
    return snapshot;
  }

  /**
   * Get entity state at a specific time
   */
  async getEntityAtTime(entityId: string, timestamp: string): Promise<EntitySnapshot | null> {
    return this.storage.getSnapshotAtTime(entityId, timestamp);
  }

  /**
   * Get current entity state
   */
  async getCurrentEntity(entityId: string): Promise<EntitySnapshot | null> {
    return this.storage.getLatestSnapshot(entityId);
  }

  /**
   * Get entity history
   */
  async getEntityHistory(entityId: string, limit?: number): Promise<EntitySnapshot[]> {
    return this.storage.getSnapshotHistory(entityId, limit);
  }

  /**
   * Compare two points in time for an entity
   */
  async compareEntityAtTimes(
    entityId: string,
    time1: string,
    time2: string
  ): Promise<{
    snapshot1: EntitySnapshot | null;
    snapshot2: EntitySnapshot | null;
    changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  }> {
    const snap1 = await this.storage.getSnapshotAtTime(entityId, time1);
    const snap2 = await this.storage.getSnapshotAtTime(entityId, time2);

    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    if (snap1 && snap2) {
      const allKeys = new Set([
        ...Object.keys(snap1.data),
        ...Object.keys(snap2.data),
      ]);

      for (const key of allKeys) {
        const old = snap1.data[key];
        const newVal = snap2.data[key];
        if (JSON.stringify(old) !== JSON.stringify(newVal)) {
          changes.push({ field: key, oldValue: old, newValue: newVal });
        }
      }
    }

    return { snapshot1: snap1, snapshot2: snap2, changes };
  }

  /**
   * Create a relationship between entities
   */
  async createRelationship(
    sourceEntityId: string,
    targetEntityId: string,
    type: string,
    properties?: Record<string, unknown>
  ): Promise<EntityRelationship> {
    const relationship: EntityRelationship = {
      sourceEntityId,
      targetEntityId,
      type,
      properties,
      establishedAt: new Date().toISOString(),
    };

    await this.storage.storeRelationship(relationship);
    return relationship;
  }

  /**
   * Execute a join query
   */
  async executeJoinQuery(query: EntityJoinQuery): Promise<EntityJoinResult[]> {
    const results: EntityJoinResult[] = [];

    // Find primary entities
    const primaryEntities = await this.storage.findEntities(
      query.primaryEntityType,
      query.primaryFilter ?? {},
      query.asOf
    );

    for (const primary of primaryEntities) {
      const joined: Record<string, EntitySnapshot> = {};
      const relationships: EntityRelationship[] = [];

      // Execute joins
      for (const join of query.joins) {
        const rels = await this.storage.getRelationships(
          primary.entityId,
          join.relationshipType,
          query.asOf
        );

        for (const rel of rels) {
          const targetId =
            rel.sourceEntityId === primary.entityId
              ? rel.targetEntityId
              : rel.sourceEntityId;

          const targetSnapshot = query.asOf
            ? await this.storage.getSnapshotAtTime(targetId, query.asOf)
            : await this.storage.getLatestSnapshot(targetId);

          if (targetSnapshot && targetSnapshot.entityType === join.entityType) {
            // Check filter
            let matches = true;
            if (join.filter) {
              for (const [key, value] of Object.entries(join.filter)) {
                if (targetSnapshot.data[key] !== value) {
                  matches = false;
                  break;
                }
              }
            }

            if (matches) {
              joined[join.alias] = targetSnapshot;
              relationships.push(rel);
            }
          }
        }
      }

      // Only include if all required joins were found
      if (Object.keys(joined).length === query.joins.length) {
        results.push({ primary, joined, relationships });
      }
    }

    return results;
  }

  private hashData(data: Record<string, unknown>): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/**
 * Create temporal entity manager
 */
export function createTemporalEntityManager(storage?: TemporalStorage): TemporalEntityManager {
  return new TemporalEntityManager(storage);
}
