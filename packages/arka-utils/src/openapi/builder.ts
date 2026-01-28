/**
 * OpenAPI Builder
 *
 * Fluent API for building OpenAPI specifications.
 */

import type {
  OpenAPIDocument,
  OpenAPIInfo,
  OpenAPIServer,
  OpenAPITag,
  OpenAPIPathItem,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPISchema,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPIResponseOrRef,
  OpenAPISecurityScheme,
  OpenAPIComponents,
} from './types.js';

/**
 * OpenAPI Document Builder
 */
export class OpenAPIBuilder {
  private doc: OpenAPIDocument;

  constructor(info: OpenAPIInfo) {
    this.doc = {
      openapi: '3.0.3',
      info,
      paths: {},
    };
  }

  /**
   * Set the OpenAPI version
   */
  setVersion(version: OpenAPIDocument['openapi']): this {
    this.doc.openapi = version;
    return this;
  }

  /**
   * Add a server
   */
  addServer(server: OpenAPIServer): this {
    if (!this.doc.servers) {
      this.doc.servers = [];
    }
    this.doc.servers.push(server);
    return this;
  }

  /**
   * Add a tag
   */
  addTag(tag: OpenAPITag): this {
    if (!this.doc.tags) {
      this.doc.tags = [];
    }
    this.doc.tags.push(tag);
    return this;
  }

  /**
   * Add a path
   */
  addPath(path: string, pathItem: OpenAPIPathItem): this {
    this.doc.paths[path] = pathItem;
    return this;
  }

  /**
   * Add or merge a path operation
   */
  addOperation(
    path: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head' | 'trace',
    operation: OpenAPIOperation
  ): this {
    if (!this.doc.paths[path]) {
      this.doc.paths[path] = {};
    }
    this.doc.paths[path][method] = operation;
    return this;
  }

  /**
   * Add a schema to components
   */
  addSchema(name: string, schema: OpenAPISchema): this {
    if (!this.doc.components) {
      this.doc.components = {};
    }
    if (!this.doc.components.schemas) {
      this.doc.components.schemas = {};
    }
    this.doc.components.schemas[name] = schema;
    return this;
  }

  /**
   * Add a response to components
   */
  addResponse(name: string, response: OpenAPIResponse): this {
    if (!this.doc.components) {
      this.doc.components = {};
    }
    if (!this.doc.components.responses) {
      this.doc.components.responses = {};
    }
    this.doc.components.responses[name] = response;
    return this;
  }

  /**
   * Add a parameter to components
   */
  addParameter(name: string, parameter: OpenAPIParameter): this {
    if (!this.doc.components) {
      this.doc.components = {};
    }
    if (!this.doc.components.parameters) {
      this.doc.components.parameters = {};
    }
    this.doc.components.parameters[name] = parameter;
    return this;
  }

  /**
   * Add a security scheme
   */
  addSecurityScheme(name: string, scheme: OpenAPISecurityScheme): this {
    if (!this.doc.components) {
      this.doc.components = {};
    }
    if (!this.doc.components.securitySchemes) {
      this.doc.components.securitySchemes = {};
    }
    this.doc.components.securitySchemes[name] = scheme;
    return this;
  }

  /**
   * Set global security requirements
   */
  setSecurity(security: Array<Record<string, string[]>>): this {
    this.doc.security = security;
    return this;
  }

  /**
   * Set external documentation
   */
  setExternalDocs(description: string, url: string): this {
    this.doc.externalDocs = { description, url };
    return this;
  }

  /**
   * Set components
   */
  setComponents(components: OpenAPIComponents): this {
    this.doc.components = components;
    return this;
  }

  /**
   * Build the final OpenAPI document
   */
  build(): OpenAPIDocument {
    return { ...this.doc };
  }

  /**
   * Build and return as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.doc, null, 2);
  }

  /**
   * Build and return as YAML string
   */
  toYAML(): string {
    return jsonToYaml(this.doc);
  }
}

/**
 * Operation Builder for fluent API operations
 */
export class OperationBuilder {
  private operation: OpenAPIOperation;

  constructor(summary?: string) {
    this.operation = {
      responses: {},
    };
    if (summary) {
      this.operation.summary = summary;
    }
  }

  tags(...tags: string[]): this {
    this.operation.tags = tags;
    return this;
  }

  summary(summary: string): this {
    this.operation.summary = summary;
    return this;
  }

  description(description: string): this {
    this.operation.description = description;
    return this;
  }

  operationId(id: string): this {
    this.operation.operationId = id;
    return this;
  }

  deprecated(deprecated = true): this {
    this.operation.deprecated = deprecated;
    return this;
  }

  parameter(param: OpenAPIParameter): this {
    if (!this.operation.parameters) {
      this.operation.parameters = [];
    }
    this.operation.parameters.push(param);
    return this;
  }

  pathParam(name: string, schema: OpenAPISchema, description?: string): this {
    return this.parameter({
      name,
      in: 'path',
      required: true,
      schema,
      description,
    });
  }

  queryParam(name: string, schema: OpenAPISchema, required = false, description?: string): this {
    return this.parameter({
      name,
      in: 'query',
      required,
      schema,
      description,
    });
  }

  headerParam(name: string, schema: OpenAPISchema, required = false, description?: string): this {
    return this.parameter({
      name,
      in: 'header',
      required,
      schema,
      description,
    });
  }

  requestBody(body: OpenAPIRequestBody): this {
    this.operation.requestBody = body;
    return this;
  }

  jsonBody(schema: OpenAPISchema, required = true, description?: string): this {
    this.operation.requestBody = {
      required,
      description,
      content: {
        'application/json': { schema },
      },
    };
    return this;
  }

  response(statusCode: string | number, response: OpenAPIResponse | OpenAPIResponseOrRef): this {
    this.operation.responses[String(statusCode)] = response;
    return this;
  }

  responseRef(statusCode: string | number, refName: string): this {
    this.operation.responses[String(statusCode)] = { $ref: `#/components/responses/${refName}` };
    return this;
  }

  jsonResponse(statusCode: string | number, schema: OpenAPISchema, description: string): this {
    return this.response(statusCode, {
      description,
      content: {
        'application/json': { schema },
      },
    });
  }

  security(...requirements: Array<Record<string, string[]>>): this {
    this.operation.security = requirements;
    return this;
  }

  bearerAuth(): this {
    return this.security({ bearerAuth: [] });
  }

  build(): OpenAPIOperation {
    return { ...this.operation };
  }
}

/**
 * Schema Builder for fluent schema definitions
 */
export class SchemaBuilder {
  private schema: OpenAPISchema;

  constructor() {
    this.schema = {};
  }

  static string(): SchemaBuilder {
    return new SchemaBuilder().type('string');
  }

  static number(): SchemaBuilder {
    return new SchemaBuilder().type('number');
  }

  static integer(): SchemaBuilder {
    return new SchemaBuilder().type('integer');
  }

  static boolean(): SchemaBuilder {
    return new SchemaBuilder().type('boolean');
  }

  static array(items: OpenAPISchema): SchemaBuilder {
    return new SchemaBuilder().type('array').items(items);
  }

  static object(properties?: Record<string, OpenAPISchema>): SchemaBuilder {
    const builder = new SchemaBuilder().type('object');
    if (properties) {
      builder.schema.properties = properties;
    }
    return builder;
  }

  static ref(name: string): OpenAPISchema {
    return { $ref: `#/components/schemas/${name}` };
  }

  type(type: OpenAPISchema['type']): this {
    this.schema.type = type;
    return this;
  }

  format(format: string): this {
    this.schema.format = format;
    return this;
  }

  description(description: string): this {
    this.schema.description = description;
    return this;
  }

  enum(...values: unknown[]): this {
    this.schema.enum = values;
    return this;
  }

  default(value: unknown): this {
    this.schema.default = value;
    return this;
  }

  example(value: unknown): this {
    this.schema.example = value;
    return this;
  }

  nullable(nullable = true): this {
    this.schema.nullable = nullable;
    return this;
  }

  readOnly(readOnly = true): this {
    this.schema.readOnly = readOnly;
    return this;
  }

  writeOnly(writeOnly = true): this {
    this.schema.writeOnly = writeOnly;
    return this;
  }

  deprecated(deprecated = true): this {
    this.schema.deprecated = deprecated;
    return this;
  }

  minimum(min: number): this {
    this.schema.minimum = min;
    return this;
  }

  maximum(max: number): this {
    this.schema.maximum = max;
    return this;
  }

  minLength(min: number): this {
    this.schema.minLength = min;
    return this;
  }

  maxLength(max: number): this {
    this.schema.maxLength = max;
    return this;
  }

  pattern(pattern: string): this {
    this.schema.pattern = pattern;
    return this;
  }

  items(items: OpenAPISchema): this {
    this.schema.items = items;
    return this;
  }

  properties(properties: Record<string, OpenAPISchema>): this {
    this.schema.properties = properties;
    return this;
  }

  property(name: string, schema: OpenAPISchema): this {
    if (!this.schema.properties) {
      this.schema.properties = {};
    }
    this.schema.properties[name] = schema;
    return this;
  }

  additionalProperties(allowed: boolean | OpenAPISchema): this {
    this.schema.additionalProperties = allowed;
    return this;
  }

  required(...names: string[]): this {
    this.schema.required = names;
    return this;
  }

  oneOf(...schemas: OpenAPISchema[]): this {
    this.schema.oneOf = schemas;
    return this;
  }

  anyOf(...schemas: OpenAPISchema[]): this {
    this.schema.anyOf = schemas;
    return this;
  }

  allOf(...schemas: OpenAPISchema[]): this {
    this.schema.allOf = schemas;
    return this;
  }

  build(): OpenAPISchema {
    return { ...this.schema };
  }
}

/**
 * Simple JSON to YAML converter (no external dependencies)
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null) return 'null';
  if (obj === undefined) return '';
  if (typeof obj === 'boolean') return obj.toString();
  if (typeof obj === 'number') return obj.toString();
  if (typeof obj === 'string') {
    // Check if string needs quoting
    if (
      obj.includes('\n') ||
      obj.includes(':') ||
      obj.includes('#') ||
      obj.startsWith(' ') ||
      obj.endsWith(' ') ||
      /^[0-9]/.test(obj) ||
      obj === 'true' ||
      obj === 'false' ||
      obj === 'null'
    ) {
      return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj
      .map(item => {
        const yaml = jsonToYaml(item, indent + 1);
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          return `\n${spaces}- ${yaml.trim().split('\n').join(`\n${spaces}  `)}`;
        }
        return `\n${spaces}- ${yaml}`;
      })
      .join('');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, value]) => {
        const yaml = jsonToYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null) {
          return `${spaces}${key}:${yaml}`;
        }
        return `${spaces}${key}: ${yaml}`;
      })
      .join('\n');
  }

  return String(obj);
}

/**
 * Create a new OpenAPI builder
 */
export function createOpenAPIBuilder(info: OpenAPIInfo): OpenAPIBuilder {
  return new OpenAPIBuilder(info);
}

/**
 * Create a new operation builder
 */
export function createOperationBuilder(summary?: string): OperationBuilder {
  return new OperationBuilder(summary);
}

/**
 * Create a new schema builder
 */
export function createSchemaBuilder(): SchemaBuilder {
  return new SchemaBuilder();
}
