/**
 * Canonical Serialization
 *
 * Deterministic JSON serialization for blockchain consensus.
 * Ensures identical data produces identical byte output across all nodes.
 */

/**
 * Options for canonical serialization
 */
export interface CanonicalOptions {
  /** Whether to include undefined values as null */
  includeUndefined?: boolean;
  /** Custom replacer function */
  replacer?: (key: string, value: unknown) => unknown;
}

/**
 * Sorts object keys recursively
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (typeof obj === 'object' && obj !== null) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }

    return sorted;
  }

  return obj;
}

/**
 * Produces a canonical (deterministic) JSON string.
 *
 * Guarantees:
 * - Keys are sorted alphabetically at all levels
 * - No whitespace (minified)
 * - Consistent number representation
 * - Identical output for identical input data
 */
export function canonicalStringify(data: unknown, options: CanonicalOptions = {}): string {
  const sorted = sortObjectKeys(data);

  return JSON.stringify(sorted, (key, value) => {
    // Handle undefined if option is set
    if (value === undefined && options.includeUndefined) {
      return null;
    }

    // Apply custom replacer if provided
    if (options.replacer) {
      return options.replacer(key, value);
    }

    // Handle special number cases
    if (typeof value === 'number') {
      // Normalize -0 to 0
      if (Object.is(value, -0)) {
        return 0;
      }
      // Handle Infinity and NaN
      if (!Number.isFinite(value)) {
        return null;
      }
    }

    // Handle BigInt
    if (typeof value === 'bigint') {
      return value.toString();
    }

    return value;
  });
}

/**
 * Produces canonical bytes from data
 */
export function canonicalSerialize(data: unknown): Buffer {
  return Buffer.from(canonicalStringify(data), 'utf8');
}

/**
 * Parses canonical JSON back to data
 */
export function canonicalParse<T = unknown>(json: string | Buffer): T {
  const str = Buffer.isBuffer(json) ? json.toString('utf8') : json;
  return JSON.parse(str) as T;
}

/**
 * Compares two values for canonical equality
 */
export function canonicalEquals(a: unknown, b: unknown): boolean {
  return canonicalStringify(a) === canonicalStringify(b);
}

/**
 * Creates a canonical representation suitable for signing/hashing
 */
export function toSignableBytes(data: unknown): Uint8Array {
  const buffer = canonicalSerialize(data);
  return new Uint8Array(buffer);
}
