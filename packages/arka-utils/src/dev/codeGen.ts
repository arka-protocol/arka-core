/**
 * Code Generation Utilities
 *
 * Helpers for generating boilerplate code, reducing repetitive work.
 */

/**
 * Service endpoint definition for code generation
 */
export interface EndpointDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  name: string;
  description?: string;
  requestBody?: TypeDefinition;
  responseBody?: TypeDefinition;
  pathParams?: ParamDefinition[];
  queryParams?: ParamDefinition[];
  tags?: string[];
}

/**
 * Type definition for code generation
 */
export interface TypeDefinition {
  name: string;
  properties: PropertyDefinition[];
  description?: string;
}

/**
 * Property definition
 */
export interface PropertyDefinition {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: unknown;
  enum?: string[];
}

/**
 * Parameter definition
 */
export interface ParamDefinition {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

/**
 * Generate TypeScript interface from type definition
 */
export function generateInterface(typeDef: TypeDefinition): string {
  const lines: string[] = [];

  if (typeDef.description) {
    lines.push('/**');
    lines.push(` * ${typeDef.description}`);
    lines.push(' */');
  }

  lines.push(`export interface ${typeDef.name} {`);

  for (const prop of typeDef.properties) {
    if (prop.description) {
      lines.push(`  /** ${prop.description} */`);
    }

    const optional = prop.required === false ? '?' : '';
    let typeStr = prop.type;

    if (prop.enum) {
      typeStr = prop.enum.map(e => `'${e}'`).join(' | ');
    }

    lines.push(`  ${prop.name}${optional}: ${typeStr};`);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate Zod schema from type definition
 */
export function generateZodSchema(typeDef: TypeDefinition): string {
  const lines: string[] = [];

  lines.push(`import { z } from 'zod';`);
  lines.push('');

  if (typeDef.description) {
    lines.push('/**');
    lines.push(` * ${typeDef.description}`);
    lines.push(' */');
  }

  lines.push(`export const ${typeDef.name}Schema = z.object({`);

  for (const prop of typeDef.properties) {
    let zodType = mapTypeToZod(prop.type);

    if (prop.enum) {
      zodType = `z.enum([${prop.enum.map(e => `'${e}'`).join(', ')}])`;
    }

    if (prop.description) {
      zodType += `.describe('${prop.description}')`;
    }

    if (prop.default !== undefined) {
      zodType += `.default(${JSON.stringify(prop.default)})`;
    }

    if (prop.required === false) {
      zodType += '.optional()';
    }

    lines.push(`  ${prop.name}: ${zodType},`);
  }

  lines.push('});');
  lines.push('');
  lines.push(`export type ${typeDef.name} = z.infer<typeof ${typeDef.name}Schema>;`);

  return lines.join('\n');
}

/**
 * Map TypeScript type to Zod type
 */
function mapTypeToZod(tsType: string): string {
  const mapping: Record<string, string> = {
    'string': 'z.string()',
    'number': 'z.number()',
    'boolean': 'z.boolean()',
    'Date': 'z.date()',
    'any': 'z.any()',
    'unknown': 'z.unknown()',
    'null': 'z.null()',
    'undefined': 'z.undefined()',
  };

  // Handle arrays
  if (tsType.endsWith('[]')) {
    const innerType = tsType.slice(0, -2);
    return `z.array(${mapTypeToZod(innerType)})`;
  }

  // Handle Record types
  if (tsType.startsWith('Record<')) {
    return 'z.record(z.string(), z.unknown())';
  }

  return mapping[tsType] || `${tsType}Schema`;
}

/**
 * Generate Express route handler boilerplate
 */
export function generateRouteHandler(endpoint: EndpointDefinition): string {
  const lines: string[] = [];
  const handlerName = `handle${capitalize(endpoint.name)}`;

  lines.push('import { Request, Response, NextFunction } from \'express\';');
  lines.push('import { z } from \'zod\';');
  lines.push('');

  // Generate validation schemas if needed
  if (endpoint.requestBody) {
    lines.push(`// Request body schema`);
    lines.push(`const ${endpoint.name}RequestSchema = z.object({`);
    for (const prop of endpoint.requestBody.properties) {
      const zodType = mapTypeToZod(prop.type);
      const optional = prop.required === false ? '.optional()' : '';
      lines.push(`  ${prop.name}: ${zodType}${optional},`);
    }
    lines.push('});');
    lines.push('');
  }

  if (endpoint.queryParams?.length) {
    lines.push(`// Query params schema`);
    lines.push(`const ${endpoint.name}QuerySchema = z.object({`);
    for (const param of endpoint.queryParams) {
      const zodType = mapTypeToZod(param.type);
      const optional = param.required === false ? '.optional()' : '';
      lines.push(`  ${param.name}: ${zodType}${optional},`);
    }
    lines.push('});');
    lines.push('');
  }

  // Generate handler
  lines.push('/**');
  lines.push(` * ${endpoint.description || endpoint.name}`);
  lines.push(` * ${endpoint.method} ${endpoint.path}`);
  lines.push(' */');
  lines.push(`export async function ${handlerName}(`);
  lines.push('  req: Request,');
  lines.push('  res: Response,');
  lines.push('  next: NextFunction');
  lines.push('): Promise<void> {');
  lines.push('  try {');

  // Validation
  if (endpoint.requestBody) {
    lines.push(`    const body = ${endpoint.name}RequestSchema.parse(req.body);`);
  }
  if (endpoint.queryParams?.length) {
    lines.push(`    const query = ${endpoint.name}QuerySchema.parse(req.query);`);
  }
  if (endpoint.pathParams?.length) {
    for (const param of endpoint.pathParams) {
      lines.push(`    const ${param.name} = req.params.${param.name};`);
    }
  }

  lines.push('');
  lines.push('    // TODO: Implement business logic');
  lines.push('');

  // Response
  if (endpoint.responseBody) {
    lines.push(`    const result: ${endpoint.responseBody.name} = {`);
    lines.push('      // TODO: populate response');
    lines.push('    };');
    lines.push('    res.json(result);');
  } else {
    lines.push('    res.status(204).send();');
  }

  lines.push('  } catch (error) {');
  lines.push('    next(error);');
  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate test file boilerplate
 */
export function generateTestFile(serviceName: string, endpoints: EndpointDefinition[]): string {
  const lines: string[] = [];

  lines.push(`import { describe, it, expect, beforeAll, afterAll } from 'vitest';`);
  lines.push(`import request from 'supertest';`);
  lines.push(`import { app } from '../app';`);
  lines.push('');
  lines.push(`describe('${serviceName}', () => {`);
  lines.push('  beforeAll(async () => {');
  lines.push('    // Setup test environment');
  lines.push('  });');
  lines.push('');
  lines.push('  afterAll(async () => {');
  lines.push('    // Cleanup');
  lines.push('  });');
  lines.push('');

  for (const endpoint of endpoints) {
    lines.push(`  describe('${endpoint.method} ${endpoint.path}', () => {`);
    lines.push(`    it('should ${endpoint.description || endpoint.name}', async () => {`);

    const method = endpoint.method.toLowerCase();
    let path = endpoint.path;

    // Replace path params with test values
    if (endpoint.pathParams) {
      for (const param of endpoint.pathParams) {
        path = path.replace(`:${param.name}`, 'test-id');
      }
    }

    lines.push(`      const response = await request(app)`);
    lines.push(`        .${method}('${path}')`);

    if (endpoint.requestBody) {
      lines.push(`        .send({`);
      lines.push(`          // TODO: Add test data`);
      lines.push(`        })`);
    }

    lines.push(`        .expect(200);`);
    lines.push('');
    lines.push('      // TODO: Add assertions');
    lines.push('      expect(response.body).toBeDefined();');
    lines.push('    });');
    lines.push('');
    lines.push(`    it('should handle errors', async () => {`);
    lines.push(`      const response = await request(app)`);
    lines.push(`        .${method}('${path}')`);
    lines.push(`        .expect(400);`);
    lines.push('');
    lines.push('      expect(response.body.error).toBeDefined();');
    lines.push('    });');
    lines.push('  });');
    lines.push('');
  }

  lines.push('});');

  return lines.join('\n');
}

/**
 * Generate service class boilerplate
 */
export function generateServiceClass(
  name: string,
  methods: { name: string; params: ParamDefinition[]; returnType: string; description?: string }[]
): string {
  const lines: string[] = [];
  const className = `${capitalize(name)}Service`;

  lines.push(`import { Logger, createLogger } from '@arka/utils';`);
  lines.push('');
  lines.push(`export interface ${className}Options {`);
  lines.push('  // Add configuration options');
  lines.push('}');
  lines.push('');
  lines.push(`export class ${className} {`);
  lines.push('  private readonly logger: Logger;');
  lines.push('');
  lines.push(`  constructor(private readonly options: ${className}Options = {}) {`);
  lines.push(`    this.logger = createLogger('${name}-service');`);
  lines.push('  }');

  for (const method of methods) {
    lines.push('');
    if (method.description) {
      lines.push('  /**');
      lines.push(`   * ${method.description}`);
      lines.push('   */');
    }

    const params = method.params
      .map(p => `${p.name}: ${p.type}`)
      .join(', ');

    lines.push(`  async ${method.name}(${params}): Promise<${method.returnType}> {`);
    lines.push(`    this.logger.debug('${method.name} called', { ${method.params.map(p => p.name).join(', ')} });`);
    lines.push('');
    lines.push('    // TODO: Implement');
    lines.push(`    throw new Error('Not implemented');`);
    lines.push('  }');
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate repository class boilerplate
 */
export function generateRepository(
  entityName: string,
  tableName: string,
  properties: PropertyDefinition[]
): string {
  const lines: string[] = [];
  const className = `${capitalize(entityName)}Repository`;

  lines.push(`import { selectFrom, insertInto, update, deleteFrom, createPaginatedResult } from '@arka/utils';`);
  lines.push(`import type { PaginationConfig, PaginatedResult } from '@arka/utils';`);
  lines.push(`import type { ${capitalize(entityName)} } from './${entityName}.types';`);
  lines.push('');
  lines.push(`export class ${className} {`);
  lines.push('  constructor(private readonly db: DatabaseClient) {}');
  lines.push('');

  // findById
  lines.push(`  async findById(id: string): Promise<${capitalize(entityName)} | null> {`);
  lines.push(`    const query = selectFrom('${tableName}')`);
  lines.push(`      .where('id', 'eq', id)`);
  lines.push(`      .build();`);
  lines.push('');
  lines.push('    const result = await this.db.query(query.text, query.values);');
  lines.push('    return result.rows[0] ?? null;');
  lines.push('  }');
  lines.push('');

  // findAll with pagination
  lines.push(`  async findAll(pagination: PaginationConfig): Promise<PaginatedResult<${capitalize(entityName)}>> {`);
  lines.push(`    const query = selectFrom('${tableName}')`);
  lines.push(`      .paginate(pagination)`);
  lines.push(`      .orderBy('created_at', 'DESC')`);
  lines.push(`      .build();`);
  lines.push('');
  lines.push(`    const countQuery = selectFrom('${tableName}').buildCount();`);
  lines.push('');
  lines.push('    const [dataResult, countResult] = await Promise.all([');
  lines.push('      this.db.query(query.text, query.values),');
  lines.push('      this.db.query(countQuery.text, countQuery.values),');
  lines.push('    ]);');
  lines.push('');
  lines.push('    return createPaginatedResult(');
  lines.push('      dataResult.rows,');
  lines.push('      parseInt(countResult.rows[0]?.count ?? 0, 10),');
  lines.push('      pagination');
  lines.push('    );');
  lines.push('  }');
  lines.push('');

  // create
  const insertColumns = properties.filter(p => p.name !== 'id' && p.name !== 'created_at' && p.name !== 'updated_at');
  lines.push(`  async create(data: Omit<${capitalize(entityName)}, 'id' | 'createdAt' | 'updatedAt'>): Promise<${capitalize(entityName)}> {`);
  lines.push(`    const query = insertInto('${tableName}')`);
  lines.push(`      .into(${insertColumns.map(p => `'${toSnakeCase(p.name)}'`).join(', ')})`);
  lines.push(`      .values(${insertColumns.map(p => `data.${p.name}`).join(', ')})`);
  lines.push(`      .returning('*')`);
  lines.push(`      .build();`);
  lines.push('');
  lines.push('    const result = await this.db.query(query.text, query.values);');
  lines.push('    return result.rows[0];');
  lines.push('  }');
  lines.push('');

  // update
  lines.push(`  async update(id: string, data: Partial<${capitalize(entityName)}>): Promise<${capitalize(entityName)} | null> {`);
  lines.push(`    const query = update('${tableName}')`);
  lines.push(`      .setObject(data)`);
  lines.push(`      .where('id', 'eq', id)`);
  lines.push(`      .returning('*')`);
  lines.push(`      .build();`);
  lines.push('');
  lines.push('    const result = await this.db.query(query.text, query.values);');
  lines.push('    return result.rows[0] ?? null;');
  lines.push('  }');
  lines.push('');

  // delete
  lines.push(`  async delete(id: string): Promise<boolean> {`);
  lines.push(`    const query = deleteFrom('${tableName}')`);
  lines.push(`      .where('id', 'eq', id)`);
  lines.push(`      .build();`);
  lines.push('');
  lines.push('    const result = await this.db.query(query.text, query.values);');
  lines.push('    return result.rowCount > 0;');
  lines.push('  }');

  lines.push('}');

  return lines.join('\n');
}

// Utility functions
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Generate migration file boilerplate
 */
export function generateMigration(
  name: string,
  tableName: string,
  properties: PropertyDefinition[]
): { up: string; down: string } {
  const upLines: string[] = [];
  const downLines: string[] = [];

  upLines.push(`-- Migration: ${name}`);
  upLines.push(`-- Created: ${new Date().toISOString()}`);
  upLines.push('');
  upLines.push(`CREATE TABLE IF NOT EXISTS ${tableName} (`);

  const columnDefs: string[] = [];
  for (const prop of properties) {
    const colName = toSnakeCase(prop.name);
    const sqlType = mapTypeToSql(prop.type);
    const nullable = prop.required === false ? '' : ' NOT NULL';
    const defaultVal = prop.default !== undefined ? ` DEFAULT ${formatSqlDefault(prop.default)}` : '';

    if (prop.name === 'id') {
      columnDefs.push(`  ${colName} UUID PRIMARY KEY DEFAULT gen_random_uuid()`);
    } else if (prop.name === 'createdAt') {
      columnDefs.push(`  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    } else if (prop.name === 'updatedAt') {
      columnDefs.push(`  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    } else {
      columnDefs.push(`  ${colName} ${sqlType}${nullable}${defaultVal}`);
    }
  }

  upLines.push(columnDefs.join(',\n'));
  upLines.push(');');
  upLines.push('');

  // Add indexes
  upLines.push(`-- Indexes`);
  upLines.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at);`);

  // Add updated_at trigger
  upLines.push('');
  upLines.push(`-- Updated at trigger`);
  upLines.push(`CREATE OR REPLACE FUNCTION update_${tableName}_updated_at()`);
  upLines.push('RETURNS TRIGGER AS $$');
  upLines.push('BEGIN');
  upLines.push('  NEW.updated_at = NOW();');
  upLines.push('  RETURN NEW;');
  upLines.push('END;');
  upLines.push('$$ LANGUAGE plpgsql;');
  upLines.push('');
  upLines.push(`CREATE TRIGGER ${tableName}_updated_at_trigger`);
  upLines.push(`  BEFORE UPDATE ON ${tableName}`);
  upLines.push('  FOR EACH ROW');
  upLines.push(`  EXECUTE FUNCTION update_${tableName}_updated_at();`);

  // Down migration
  downLines.push(`-- Rollback: ${name}`);
  downLines.push('');
  downLines.push(`DROP TRIGGER IF EXISTS ${tableName}_updated_at_trigger ON ${tableName};`);
  downLines.push(`DROP FUNCTION IF EXISTS update_${tableName}_updated_at();`);
  downLines.push(`DROP TABLE IF EXISTS ${tableName};`);

  return {
    up: upLines.join('\n'),
    down: downLines.join('\n'),
  };
}

function mapTypeToSql(tsType: string): string {
  const mapping: Record<string, string> = {
    'string': 'TEXT',
    'number': 'NUMERIC',
    'boolean': 'BOOLEAN',
    'Date': 'TIMESTAMPTZ',
    'object': 'JSONB',
  };

  if (tsType.endsWith('[]')) {
    const innerType = tsType.slice(0, -2);
    return `${mapping[innerType] || 'TEXT'}[]`;
  }

  return mapping[tsType] || 'TEXT';
}

function formatSqlDefault(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value === null) return 'NULL';
  return String(value);
}
