/**
 * Query Builder
 *
 * Type-safe SQL query builder with parameterized queries.
 * Helps prevent SQL injection and promotes query optimization.
 */

import type {
  FilterCondition,
  FilterOperator,
  SortConfig,
  SortDirection,
  PaginationConfig,
  PaginatedResult,
} from './types.js';

/**
 * SQL query with parameters
 */
export interface SqlQuery {
  text: string;
  values: unknown[];
}

/**
 * Query builder for SELECT statements
 */
export class SelectBuilder<T = unknown> {
  private tableName: string;
  private selectedColumns: string[] = ['*'];
  private whereConditions: { sql: string; values: unknown[] }[] = [];
  private joinClauses: string[] = [];
  private groupByColumns: string[] = [];
  private havingConditions: string[] = [];
  private orderByClause: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private distinctFlag = false;
  private forUpdateFlag = false;
  private paramIndex = 1;

  constructor(table: string) {
    this.tableName = this.sanitizeIdentifier(table);
  }

  /**
   * Sanitize identifier to prevent SQL injection
   */
  private sanitizeIdentifier(identifier: string): string {
    // Only allow alphanumeric, underscore, and dot (for schema.table)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }

  /**
   * Get next parameter placeholder
   */
  private nextParam(): string {
    return `$${this.paramIndex++}`;
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.selectedColumns = columns.map(c => this.sanitizeIdentifier(c));
    return this;
  }

  /**
   * Select with aliases
   */
  selectAs(columns: Record<string, string>): this {
    this.selectedColumns = Object.entries(columns).map(
      ([col, alias]) => `${this.sanitizeIdentifier(col)} AS ${this.sanitizeIdentifier(alias)}`
    );
    return this;
  }

  /**
   * Add DISTINCT
   */
  distinct(): this {
    this.distinctFlag = true;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(field: string, operator: FilterOperator, value: unknown): this {
    const sanitizedField = this.sanitizeIdentifier(field);
    let sql: string;
    const values: unknown[] = [];

    switch (operator) {
      case 'eq':
        sql = `${sanitizedField} = ${this.nextParam()}`;
        values.push(value);
        break;
      case 'neq':
        sql = `${sanitizedField} <> ${this.nextParam()}`;
        values.push(value);
        break;
      case 'gt':
        sql = `${sanitizedField} > ${this.nextParam()}`;
        values.push(value);
        break;
      case 'gte':
        sql = `${sanitizedField} >= ${this.nextParam()}`;
        values.push(value);
        break;
      case 'lt':
        sql = `${sanitizedField} < ${this.nextParam()}`;
        values.push(value);
        break;
      case 'lte':
        sql = `${sanitizedField} <= ${this.nextParam()}`;
        values.push(value);
        break;
      case 'like':
        sql = `${sanitizedField} LIKE ${this.nextParam()}`;
        values.push(value);
        break;
      case 'ilike':
        sql = `${sanitizedField} ILIKE ${this.nextParam()}`;
        values.push(value);
        break;
      case 'in':
        if (!Array.isArray(value) || value.length === 0) {
          sql = '1 = 0'; // Always false for empty IN
        } else {
          const placeholders = value.map(() => this.nextParam()).join(', ');
          sql = `${sanitizedField} IN (${placeholders})`;
          values.push(...value);
        }
        break;
      case 'nin':
        if (!Array.isArray(value) || value.length === 0) {
          sql = '1 = 1'; // Always true for empty NOT IN
        } else {
          const placeholders = value.map(() => this.nextParam()).join(', ');
          sql = `${sanitizedField} NOT IN (${placeholders})`;
          values.push(...value);
        }
        break;
      case 'null':
        sql = `${sanitizedField} IS NULL`;
        break;
      case 'nnull':
        sql = `${sanitizedField} IS NOT NULL`;
        break;
      case 'between':
        if (!Array.isArray(value) || value.length !== 2) {
          throw new Error('BETWEEN requires array of [min, max]');
        }
        sql = `${sanitizedField} BETWEEN ${this.nextParam()} AND ${this.nextParam()}`;
        values.push(...value);
        break;
      case 'contains':
        sql = `${this.nextParam()} = ANY(${sanitizedField})`;
        values.push(value);
        break;
      case 'overlaps':
        sql = `${sanitizedField} && ${this.nextParam()}`;
        values.push(value);
        break;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }

    this.whereConditions.push({ sql, values });
    return this;
  }

  /**
   * Add WHERE condition from filter object
   */
  whereFilter(filter: FilterCondition): this {
    return this.where(filter.field, filter.operator, filter.value);
  }

  /**
   * Add multiple WHERE conditions (AND)
   */
  whereFilters(filters: FilterCondition[]): this {
    for (const filter of filters) {
      this.whereFilter(filter);
    }
    return this;
  }

  /**
   * Add raw WHERE clause (use with caution - ensure values are parameterized)
   */
  whereRaw(sql: string, values: unknown[] = []): this {
    // Update param indices in the raw SQL
    let adjustedSql = sql;
    const offset = this.paramIndex - 1;
    if (offset > 0) {
      adjustedSql = sql.replace(/\$(\d+)/g, (_, num) => `$${parseInt(num) + offset}`);
    }
    this.paramIndex += values.length;
    this.whereConditions.push({ sql: adjustedSql, values });
    return this;
  }

  /**
   * INNER JOIN
   */
  join(table: string, on: string): this {
    this.joinClauses.push(`INNER JOIN ${this.sanitizeIdentifier(table)} ON ${on}`);
    return this;
  }

  /**
   * LEFT JOIN
   */
  leftJoin(table: string, on: string): this {
    this.joinClauses.push(`LEFT JOIN ${this.sanitizeIdentifier(table)} ON ${on}`);
    return this;
  }

  /**
   * RIGHT JOIN
   */
  rightJoin(table: string, on: string): this {
    this.joinClauses.push(`RIGHT JOIN ${this.sanitizeIdentifier(table)} ON ${on}`);
    return this;
  }

  /**
   * GROUP BY
   */
  groupBy(...columns: string[]): this {
    this.groupByColumns = columns.map(c => this.sanitizeIdentifier(c));
    return this;
  }

  /**
   * HAVING (use after GROUP BY)
   */
  having(condition: string): this {
    this.havingConditions.push(condition);
    return this;
  }

  /**
   * ORDER BY
   */
  orderBy(column: string, direction: SortDirection = 'ASC', nulls?: 'FIRST' | 'LAST'): this {
    let clause = `${this.sanitizeIdentifier(column)} ${direction}`;
    if (nulls) {
      clause += ` NULLS ${nulls}`;
    }
    this.orderByClause.push(clause);
    return this;
  }

  /**
   * Order by configuration object
   */
  orderByConfig(config: SortConfig): this {
    return this.orderBy(config.column, config.direction, config.nulls);
  }

  /**
   * Multiple order by
   */
  orderByConfigs(configs: SortConfig[]): this {
    for (const config of configs) {
      this.orderByConfig(config);
    }
    return this;
  }

  /**
   * LIMIT
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * OFFSET
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Pagination helper
   */
  paginate(config: PaginationConfig): this {
    const { page, pageSize } = config;
    this.limitValue = pageSize;
    this.offsetValue = (page - 1) * pageSize;
    return this;
  }

  /**
   * FOR UPDATE (row locking)
   */
  forUpdate(): this {
    this.forUpdateFlag = true;
    return this;
  }

  /**
   * Build the SQL query
   */
  build(): SqlQuery {
    const parts: string[] = [];
    const allValues: unknown[] = [];

    // SELECT
    parts.push(`SELECT ${this.distinctFlag ? 'DISTINCT ' : ''}${this.selectedColumns.join(', ')}`);

    // FROM
    parts.push(`FROM ${this.tableName}`);

    // JOINs
    if (this.joinClauses.length > 0) {
      parts.push(this.joinClauses.join(' '));
    }

    // WHERE
    if (this.whereConditions.length > 0) {
      const whereParts = this.whereConditions.map(c => c.sql);
      parts.push(`WHERE ${whereParts.join(' AND ')}`);
      for (const cond of this.whereConditions) {
        allValues.push(...cond.values);
      }
    }

    // GROUP BY
    if (this.groupByColumns.length > 0) {
      parts.push(`GROUP BY ${this.groupByColumns.join(', ')}`);
    }

    // HAVING
    if (this.havingConditions.length > 0) {
      parts.push(`HAVING ${this.havingConditions.join(' AND ')}`);
    }

    // ORDER BY
    if (this.orderByClause.length > 0) {
      parts.push(`ORDER BY ${this.orderByClause.join(', ')}`);
    }

    // LIMIT
    if (this.limitValue !== undefined) {
      parts.push(`LIMIT ${this.limitValue}`);
    }

    // OFFSET
    if (this.offsetValue !== undefined) {
      parts.push(`OFFSET ${this.offsetValue}`);
    }

    // FOR UPDATE
    if (this.forUpdateFlag) {
      parts.push('FOR UPDATE');
    }

    return {
      text: parts.join(' '),
      values: allValues,
    };
  }

  /**
   * Build a COUNT query (for pagination)
   */
  buildCount(): SqlQuery {
    const parts: string[] = [];
    const allValues: unknown[] = [];

    // SELECT COUNT
    parts.push('SELECT COUNT(*) as count');

    // FROM
    parts.push(`FROM ${this.tableName}`);

    // JOINs
    if (this.joinClauses.length > 0) {
      parts.push(this.joinClauses.join(' '));
    }

    // WHERE
    if (this.whereConditions.length > 0) {
      const whereParts = this.whereConditions.map(c => c.sql);
      parts.push(`WHERE ${whereParts.join(' AND ')}`);
      for (const cond of this.whereConditions) {
        allValues.push(...cond.values);
      }
    }

    return {
      text: parts.join(' '),
      values: allValues,
    };
  }
}

/**
 * Query builder for INSERT statements
 */
export class InsertBuilder<T = unknown> {
  private tableName: string;
  private columns: string[] = [];
  private valueRows: unknown[][] = [];
  private returningColumns: string[] = [];
  private conflictTarget?: string;
  private conflictAction?: 'nothing' | 'update';
  private conflictUpdateColumns?: string[];

  constructor(table: string) {
    this.tableName = this.sanitizeIdentifier(table);
  }

  private sanitizeIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }

  /**
   * Set columns
   */
  into(...columns: string[]): this {
    this.columns = columns.map(c => this.sanitizeIdentifier(c));
    return this;
  }

  /**
   * Add single row
   */
  values(...row: unknown[]): this {
    if (row.length !== this.columns.length) {
      throw new Error(`Value count (${row.length}) doesn't match column count (${this.columns.length})`);
    }
    this.valueRows.push(row);
    return this;
  }

  /**
   * Add row from object
   */
  valuesObject(obj: Record<string, unknown>): this {
    const row: unknown[] = [];
    for (const col of this.columns) {
      row.push(obj[col]);
    }
    this.valueRows.push(row);
    return this;
  }

  /**
   * Add multiple rows
   */
  valuesMultiple(rows: unknown[][]): this {
    for (const row of rows) {
      this.values(...row);
    }
    return this;
  }

  /**
   * ON CONFLICT DO NOTHING
   */
  onConflictDoNothing(target?: string): this {
    this.conflictTarget = target ? this.sanitizeIdentifier(target) : undefined;
    this.conflictAction = 'nothing';
    return this;
  }

  /**
   * ON CONFLICT DO UPDATE
   */
  onConflictDoUpdate(target: string, updateColumns: string[]): this {
    this.conflictTarget = this.sanitizeIdentifier(target);
    this.conflictAction = 'update';
    this.conflictUpdateColumns = updateColumns.map(c => this.sanitizeIdentifier(c));
    return this;
  }

  /**
   * RETURNING
   */
  returning(...columns: string[]): this {
    this.returningColumns = columns.map(c => c === '*' ? '*' : this.sanitizeIdentifier(c));
    return this;
  }

  /**
   * Build the SQL query
   */
  build(): SqlQuery {
    if (this.columns.length === 0 || this.valueRows.length === 0) {
      throw new Error('Must specify columns and values');
    }

    const parts: string[] = [];
    const allValues: unknown[] = [];
    let paramIndex = 1;

    // INSERT INTO
    parts.push(`INSERT INTO ${this.tableName} (${this.columns.join(', ')})`);

    // VALUES
    const valuePlaceholders = this.valueRows.map((row) => {
      const placeholders = row.map(() => `$${paramIndex++}`);
      allValues.push(...row);
      return `(${placeholders.join(', ')})`;
    });
    parts.push(`VALUES ${valuePlaceholders.join(', ')}`);

    // ON CONFLICT
    if (this.conflictAction) {
      const target = this.conflictTarget ? `(${this.conflictTarget})` : '';
      if (this.conflictAction === 'nothing') {
        parts.push(`ON CONFLICT ${target} DO NOTHING`);
      } else if (this.conflictAction === 'update' && this.conflictUpdateColumns) {
        const updates = this.conflictUpdateColumns.map(c => `${c} = EXCLUDED.${c}`);
        parts.push(`ON CONFLICT ${target} DO UPDATE SET ${updates.join(', ')}`);
      }
    }

    // RETURNING
    if (this.returningColumns.length > 0) {
      parts.push(`RETURNING ${this.returningColumns.join(', ')}`);
    }

    return {
      text: parts.join(' '),
      values: allValues,
    };
  }
}

/**
 * Query builder for UPDATE statements
 */
export class UpdateBuilder<T = unknown> {
  private tableName: string;
  private setValues: { column: string; value: unknown; isRaw: boolean }[] = [];
  private whereConditions: { sql: string; values: unknown[] }[] = [];
  private returningColumns: string[] = [];
  private paramIndex = 1;

  constructor(table: string) {
    this.tableName = this.sanitizeIdentifier(table);
  }

  private sanitizeIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }

  private nextParam(): string {
    return `$${this.paramIndex++}`;
  }

  /**
   * SET column = value
   */
  set(column: string, value: unknown): this {
    this.setValues.push({
      column: this.sanitizeIdentifier(column),
      value,
      isRaw: false,
    });
    return this;
  }

  /**
   * SET from object
   */
  setObject(obj: Record<string, unknown>): this {
    for (const [column, value] of Object.entries(obj)) {
      this.set(column, value);
    }
    return this;
  }

  /**
   * SET column = raw expression
   */
  setRaw(column: string, expression: string): this {
    this.setValues.push({
      column: this.sanitizeIdentifier(column),
      value: expression,
      isRaw: true,
    });
    return this;
  }

  /**
   * WHERE condition
   */
  where(field: string, operator: FilterOperator, value: unknown): this {
    const sanitizedField = this.sanitizeIdentifier(field);
    let sql: string;
    const values: unknown[] = [];

    switch (operator) {
      case 'eq':
        sql = `${sanitizedField} = ${this.nextParam()}`;
        values.push(value);
        break;
      case 'neq':
        sql = `${sanitizedField} <> ${this.nextParam()}`;
        values.push(value);
        break;
      case 'in':
        if (!Array.isArray(value) || value.length === 0) {
          sql = '1 = 0';
        } else {
          const placeholders = value.map(() => this.nextParam()).join(', ');
          sql = `${sanitizedField} IN (${placeholders})`;
          values.push(...value);
        }
        break;
      default:
        sql = `${sanitizedField} = ${this.nextParam()}`;
        values.push(value);
    }

    this.whereConditions.push({ sql, values });
    return this;
  }

  /**
   * RETURNING
   */
  returning(...columns: string[]): this {
    this.returningColumns = columns.map(c => c === '*' ? '*' : this.sanitizeIdentifier(c));
    return this;
  }

  /**
   * Build the SQL query
   */
  build(): SqlQuery {
    if (this.setValues.length === 0) {
      throw new Error('Must specify at least one SET value');
    }

    const parts: string[] = [];
    const allValues: unknown[] = [];
    let paramIdx = 1;

    // UPDATE
    parts.push(`UPDATE ${this.tableName}`);

    // SET
    const setClauses = this.setValues.map((s) => {
      if (s.isRaw) {
        return `${s.column} = ${s.value}`;
      }
      allValues.push(s.value);
      return `${s.column} = $${paramIdx++}`;
    });
    parts.push(`SET ${setClauses.join(', ')}`);

    // WHERE
    if (this.whereConditions.length > 0) {
      const whereParts = this.whereConditions.map((c) => {
        // Adjust parameter indices
        let adjustedSql = c.sql;
        for (const v of c.values) {
          adjustedSql = adjustedSql.replace(/\$\d+/, `$${paramIdx++}`);
          allValues.push(v);
        }
        return adjustedSql;
      });
      parts.push(`WHERE ${whereParts.join(' AND ')}`);
    }

    // RETURNING
    if (this.returningColumns.length > 0) {
      parts.push(`RETURNING ${this.returningColumns.join(', ')}`);
    }

    return {
      text: parts.join(' '),
      values: allValues,
    };
  }
}

/**
 * Query builder for DELETE statements
 */
export class DeleteBuilder<T = unknown> {
  private tableName: string;
  private whereConditions: { sql: string; values: unknown[] }[] = [];
  private returningColumns: string[] = [];
  private paramIndex = 1;

  constructor(table: string) {
    this.tableName = this.sanitizeIdentifier(table);
  }

  private sanitizeIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }

  private nextParam(): string {
    return `$${this.paramIndex++}`;
  }

  /**
   * WHERE condition
   */
  where(field: string, operator: FilterOperator, value: unknown): this {
    const sanitizedField = this.sanitizeIdentifier(field);
    let sql: string;
    const values: unknown[] = [];

    switch (operator) {
      case 'eq':
        sql = `${sanitizedField} = ${this.nextParam()}`;
        values.push(value);
        break;
      case 'in':
        if (!Array.isArray(value) || value.length === 0) {
          sql = '1 = 0';
        } else {
          const placeholders = value.map(() => this.nextParam()).join(', ');
          sql = `${sanitizedField} IN (${placeholders})`;
          values.push(...value);
        }
        break;
      default:
        sql = `${sanitizedField} = ${this.nextParam()}`;
        values.push(value);
    }

    this.whereConditions.push({ sql, values });
    return this;
  }

  /**
   * RETURNING
   */
  returning(...columns: string[]): this {
    this.returningColumns = columns.map(c => c === '*' ? '*' : this.sanitizeIdentifier(c));
    return this;
  }

  /**
   * Build the SQL query
   */
  build(): SqlQuery {
    const parts: string[] = [];
    const allValues: unknown[] = [];

    // DELETE FROM
    parts.push(`DELETE FROM ${this.tableName}`);

    // WHERE
    if (this.whereConditions.length > 0) {
      const whereParts = this.whereConditions.map(c => c.sql);
      parts.push(`WHERE ${whereParts.join(' AND ')}`);
      for (const cond of this.whereConditions) {
        allValues.push(...cond.values);
      }
    }

    // RETURNING
    if (this.returningColumns.length > 0) {
      parts.push(`RETURNING ${this.returningColumns.join(', ')}`);
    }

    return {
      text: parts.join(' '),
      values: allValues,
    };
  }
}

/**
 * Factory functions
 */
export function selectFrom<T = unknown>(table: string): SelectBuilder<T> {
  return new SelectBuilder<T>(table);
}

export function insertInto<T = unknown>(table: string): InsertBuilder<T> {
  return new InsertBuilder<T>(table);
}

export function update<T = unknown>(table: string): UpdateBuilder<T> {
  return new UpdateBuilder<T>(table);
}

export function deleteFrom<T = unknown>(table: string): DeleteBuilder<T> {
  return new DeleteBuilder<T>(table);
}

/**
 * Helper to create paginated result
 */
export function createPaginatedResult<T>(
  data: T[],
  totalCount: number,
  config: PaginationConfig
): PaginatedResult<T> {
  const totalPages = Math.ceil(totalCount / config.pageSize);
  return {
    data,
    pagination: {
      page: config.page,
      pageSize: config.pageSize,
      totalCount,
      totalPages,
      hasNextPage: config.page < totalPages,
      hasPreviousPage: config.page > 1,
    },
  };
}
