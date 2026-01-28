/**
 * OpenAPI Middleware
 *
 * Express middleware for serving OpenAPI documentation.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { OpenAPIDocument } from './types.js';

/**
 * Options for the OpenAPI middleware
 */
export interface OpenAPIMiddlewareOptions {
  /** Path to serve the OpenAPI JSON spec */
  jsonPath?: string;
  /** Path to serve the OpenAPI YAML spec */
  yamlPath?: string;
  /** Path to serve Swagger UI */
  uiPath?: string;
  /** Custom CSS for Swagger UI */
  customCss?: string;
  /** Custom favicon URL */
  favicon?: string;
  /** Enable CORS headers */
  cors?: boolean;
}

/**
 * Creates middleware to serve OpenAPI JSON specification
 */
export function createOpenAPIJsonHandler(
  spec: OpenAPIDocument | (() => OpenAPIDocument),
  options: { cors?: boolean } = {}
): RequestHandler {
  return (_req: Request, res: Response) => {
    if (options.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Content-Type', 'application/json');
    const doc = typeof spec === 'function' ? spec() : spec;
    res.json(doc);
  };
}

/**
 * Creates middleware to serve OpenAPI YAML specification
 */
export function createOpenAPIYamlHandler(
  spec: OpenAPIDocument | (() => OpenAPIDocument),
  options: { cors?: boolean } = {}
): RequestHandler {
  return (_req: Request, res: Response) => {
    if (options.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Content-Type', 'text/yaml');
    const doc = typeof spec === 'function' ? spec() : spec;
    res.send(jsonToYaml(doc));
  };
}

/**
 * Creates middleware to serve Swagger UI
 */
export function createSwaggerUIHandler(
  specUrl: string,
  options: {
    title?: string;
    customCss?: string;
    favicon?: string;
  } = {}
): RequestHandler {
  const html = generateSwaggerUIHtml(specUrl, options);

  return (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  };
}

/**
 * Creates middleware to serve ReDoc documentation
 */
export function createReDocHandler(
  specUrl: string,
  options: {
    title?: string;
  } = {}
): RequestHandler {
  const html = generateReDocHtml(specUrl, options);

  return (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  };
}

/**
 * Combined OpenAPI documentation router setup
 */
export interface OpenAPIDocsConfig {
  spec: OpenAPIDocument | (() => OpenAPIDocument);
  basePath?: string;
  jsonPath?: string;
  yamlPath?: string;
  uiPath?: string;
  redocPath?: string;
  title?: string;
  customCss?: string;
  favicon?: string;
  cors?: boolean;
}

/**
 * Registers OpenAPI documentation routes on an Express app
 */
export function registerOpenAPIDocs(
  app: { get: (path: string, handler: RequestHandler) => void },
  config: OpenAPIDocsConfig
): void {
  const {
    spec,
    basePath = '/api-docs',
    jsonPath = '/openapi.json',
    yamlPath = '/openapi.yaml',
    uiPath = '/',
    redocPath = '/redoc',
    title,
    customCss,
    favicon,
    cors = true,
  } = config;

  const fullJsonPath = `${basePath}${jsonPath}`;
  const fullYamlPath = `${basePath}${yamlPath}`;
  const fullUiPath = `${basePath}${uiPath}`;
  const fullRedocPath = `${basePath}${redocPath}`;

  // Register JSON endpoint
  app.get(fullJsonPath, createOpenAPIJsonHandler(spec, { cors }));

  // Register YAML endpoint
  app.get(fullYamlPath, createOpenAPIYamlHandler(spec, { cors }));

  // Register Swagger UI
  app.get(fullUiPath, createSwaggerUIHandler(fullJsonPath, { title, customCss, favicon }));

  // Register ReDoc
  app.get(fullRedocPath, createReDocHandler(fullJsonPath, { title }));
}

/**
 * Generate Swagger UI HTML
 */
function generateSwaggerUIHtml(
  specUrl: string,
  options: { title?: string; customCss?: string; favicon?: string }
): string {
  const title = options.title || 'API Documentation';
  const favicon = options.favicon || 'https://swagger.io/favicon-32x32.png';
  const customCss = options.customCss || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/png" href="${escapeHtml(favicon)}">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; padding: 0; }
    ${customCss}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "${escapeHtml(specUrl)}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        tryItOutEnabled: true,
      });
      window.ui = ui;
    };
  </script>
</body>
</html>`;
}

/**
 * Generate ReDoc HTML
 */
function generateReDocHtml(
  specUrl: string,
  options: { title?: string }
): string {
  const title = options.title || 'API Documentation';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <redoc spec-url="${escapeHtml(specUrl)}"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Simple JSON to YAML converter
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null) return 'null';
  if (obj === undefined) return '';
  if (typeof obj === 'boolean') return obj.toString();
  if (typeof obj === 'number') return obj.toString();
  if (typeof obj === 'string') {
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
