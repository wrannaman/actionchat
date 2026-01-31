import crypto from 'crypto';

/**
 * Parse an OpenAPI 3.x spec into ActionChat source metadata and tools.
 *
 * @param {string|object} specInput - Raw JSON string or parsed object
 * @returns {{ source_meta: object, tools: object[] }}
 */
export function parseOpenApiSpec(specInput) {
  const spec = typeof specInput === 'string' ? JSON.parse(specInput) : specInput;

  if (!spec.openapi || !spec.paths) {
    throw new Error('Invalid OpenAPI spec: must have "openapi" and "paths" fields');
  }

  const majorVersion = parseInt(spec.openapi.split('.')[0], 10);
  if (majorVersion < 3) {
    throw new Error(`Unsupported OpenAPI version: ${spec.openapi}. Only 3.x is supported.`);
  }

  const base_url = spec.servers?.[0]?.url || '';
  const spec_hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(spec))
    .digest('hex');

  const source_meta = {
    title: spec.info?.title || 'Untitled API',
    description: spec.info?.description || '',
    version: spec.info?.version || '',
    base_url,
    spec_hash,
  };

  const tools = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const upperMethod = method.toUpperCase();
      const operation_id =
        operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;

      const name = operation.summary || `${upperMethod} ${path}`;
      const description = operation.description || '';

      // Build parameters JSON Schema from path + query params
      const parameters = buildParametersSchema(operation.parameters || [], pathItem.parameters || []);

      // Extract request body schema
      const request_body = extractRequestBody(operation.requestBody);

      // Determine risk level
      const risk_level = getRiskLevel(upperMethod);
      const requires_confirmation = risk_level === 'dangerous';

      const tags = operation.tags || [];

      tools.push({
        operation_id,
        name,
        description,
        method: upperMethod,
        path,
        parameters,
        request_body,
        risk_level,
        requires_confirmation,
        tags,
      });
    }
  }

  return { source_meta, tools };
}

/**
 * Merge path-level and operation-level parameters into a JSON Schema object.
 */
function buildParametersSchema(operationParams, pathParams) {
  // Operation params override path params by name+in
  const merged = new Map();
  for (const p of pathParams) {
    merged.set(`${p.in}:${p.name}`, p);
  }
  for (const p of operationParams) {
    merged.set(`${p.in}:${p.name}`, p);
  }

  if (merged.size === 0) return null;

  const properties = {};
  const required = [];

  for (const param of merged.values()) {
    properties[param.name] = {
      ...(param.schema || {}),
      description: param.description || undefined,
      in: param.in,
    };
    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Extract the JSON request body schema from an OpenAPI requestBody.
 */
function extractRequestBody(requestBody) {
  if (!requestBody) return null;
  const jsonContent = requestBody.content?.['application/json'];
  if (!jsonContent?.schema) return null;
  return sanitizeSchema(jsonContent.schema);
}

/**
 * Sanitize a JSON Schema to fix common issues from poorly-written OpenAPI specs.
 * - Fixes type: "None" (Python artifact)
 * - Fixes type: null
 * - Ensures objects have type: "object"
 */
function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }

  const cleaned = { ...schema };

  // Fix invalid type values
  if (!cleaned.type || cleaned.type === 'None' || cleaned.type === 'null' || cleaned.type === null) {
    // If it has properties, it's an object
    if (cleaned.properties) {
      cleaned.type = 'object';
    } else {
      cleaned.type = 'string';
    }
  }

  // Recursively clean properties
  if (cleaned.properties && typeof cleaned.properties === 'object') {
    cleaned.properties = Object.fromEntries(
      Object.entries(cleaned.properties).map(([key, value]) => [
        key,
        sanitizeSchema(value),
      ])
    );
  }

  // Recursively clean items (for arrays)
  if (cleaned.items && typeof cleaned.items === 'object') {
    cleaned.items = sanitizeSchema(cleaned.items);
  }

  // Clean additionalProperties if it's a schema
  if (cleaned.additionalProperties && typeof cleaned.additionalProperties === 'object') {
    cleaned.additionalProperties = sanitizeSchema(cleaned.additionalProperties);
  }

  return cleaned;
}

/**
 * Determine risk level from HTTP method.
 */
function getRiskLevel(method) {
  switch (method) {
    case 'GET':
    case 'HEAD':
    case 'OPTIONS':
      return 'safe';
    case 'POST':
      return 'moderate';
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
      return 'dangerous';
    default:
      return 'moderate';
  }
}
