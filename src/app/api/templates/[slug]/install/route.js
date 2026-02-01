import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserOrgId } from '@/utils/supabase/server';
import { parseOpenApiSpec } from '@/lib/openapi-parser';
import { convertTools as convertMcpTools } from '@/lib/mcp-parser';
import * as mcpManager from '@/lib/mcp-manager';
import { cookies } from 'next/headers';
import { getPermissions, requireAdmin } from '@/utils/permissions';
import integrationsData from '../../../../../../docs/integrations.json';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/[slug]/install — Install a template as a new source
 *
 * Body: {
 *   credentials: {
 *     // Depends on auth_type, e.g.:
 *     // For bearer: { token: "..." }
 *     // For api_key: { api_key: "...", header_name?: "..." }
 *     // For basic: { username: "...", password: "..." }
 *     // For MCP: { connection_string: "..." } or env vars
 *   },
 *   name?: string, // Override default name
 *   base_url?: string, // Override base URL (for templates with placeholders)
 * }
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const perms = await getPermissions(user.id, orgId);
    const adminErr = requireAdmin(perms);
    if (adminErr) {
      return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });
    }

    const { slug } = await params;
    const template = integrationsData.integrations.find((i) => i.slug === slug);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await request.json();
    const { credentials = {}, name, base_url } = body;

    // Validate required credentials based on auth_type
    const credentialError = validateCredentials(template, credentials);
    if (credentialError) {
      return NextResponse.json({ error: credentialError }, { status: 400 });
    }

    // Resolve the base URL (handle placeholders)
    const resolvedBaseUrl = resolveBaseUrl(template.base_url || base_url, body);

    let specContent = null;
    let parsedTools = [];
    let specHash = null;
    let mcpEnv = {};

    if (template.type === 'openapi') {
      // Fetch and parse OpenAPI spec
      if (template.spec_url) {
        try {
          const fetchRes = await fetch(template.spec_url, {
            headers: { Accept: 'application/json, application/yaml' },
            signal: AbortSignal.timeout(30000),
          });

          if (!fetchRes.ok) {
            return NextResponse.json(
              {
                error: `Failed to fetch spec from ${template.spec_url}: ${fetchRes.status}`,
              },
              { status: 400 }
            );
          }

          const contentType = fetchRes.headers.get('content-type') || '';
          if (contentType.includes('yaml') || template.spec_url.endsWith('.yaml')) {
            // Would need yaml parser for YAML specs
            const text = await fetchRes.text();
            // For now, only handle JSON
            try {
              specContent = JSON.parse(text);
            } catch {
              return NextResponse.json(
                { error: 'YAML specs not yet supported. Please use JSON spec.' },
                { status: 400 }
              );
            }
          } else {
            specContent = await fetchRes.json();
          }
        } catch (fetchError) {
          return NextResponse.json(
            { error: 'Failed to fetch spec', details: fetchError.message },
            { status: 400 }
          );
        }
      }

      // Parse the spec
      if (specContent) {
        try {
          const parsed = parseOpenApiSpec(specContent);
          parsedTools = parsed.tools;
          specHash = parsed.source_meta.spec_hash;
        } catch (parseError) {
          return NextResponse.json(
            { error: 'Failed to parse OpenAPI spec', details: parseError.message },
            { status: 400 }
          );
        }
      }
    } else if (template.type === 'mcp') {
      // Determine MCP transport and server URI
      const isHttpMcp = template.mcp_transport === 'http' || template.mcp_server_url;
      let mcpServerUri;
      let mcpAuthToken = null;

      if (isHttpMcp) {
        // HTTP MCP - use remote server URL
        mcpServerUri = template.mcp_server_url;

        // For bearer auth, pass the API key as auth token
        if (template.auth_type === 'bearer') {
          const credField = template.auth_config?.credential_field || 'api_key';
          mcpAuthToken = credentials[credField];
        }
      } else {
        // stdio MCP - use npm package
        mcpServerUri = template.mcp_package?.startsWith('@')
          ? `npx -y ${template.mcp_package}`
          : template.mcp_package;

        // Build MCP environment from credentials
        if (template.auth_config?.env_var) {
          const credField = template.auth_config.credential_field;
          if (credentials[credField]) {
            mcpEnv[template.auth_config.env_var] = credentials[credField];
          }
        }
      }

      try {
        // Temporarily connect to list tools
        const mcpConfig = {
          mcp_server_uri: mcpServerUri,
          mcp_transport: isHttpMcp ? 'http' : 'stdio',
          mcp_env: mcpEnv,
          mcp_auth_token: mcpAuthToken,
        };

        const mcpTools = await mcpManager.listTools(`temp-${slug}`, mcpConfig);
        parsedTools = convertMcpTools(mcpTools, null); // source_id will be set after insert

        // Disconnect temp connection
        mcpManager.disconnect(`temp-${slug}`);
      } catch (mcpError) {
        console.error('[TEMPLATES] MCP connection error:', mcpError);
        return NextResponse.json(
          { error: 'Failed to connect to MCP server', details: mcpError.message },
          { status: 400 }
        );
      }
    }

    // Format credentials for storage
    const formattedCredentials = formatCredentials(template, credentials);

    // Determine MCP config for source storage
    let sourceMcpUri = null;
    let sourceMcpTransport = null;
    let sourceMcpEnv = null;

    if (template.type === 'mcp') {
      const isHttpMcp = template.mcp_transport === 'http' || template.mcp_server_url;
      if (isHttpMcp) {
        sourceMcpUri = template.mcp_server_url;
        sourceMcpTransport = 'http';
      } else {
        sourceMcpUri = template.mcp_package?.startsWith('@')
          ? `npx -y ${template.mcp_package}`
          : template.mcp_package;
        sourceMcpTransport = 'stdio';
        sourceMcpEnv = mcpEnv;
      }
    }

    // Create the source
    const sourceData = {
      org_id: orgId,
      template_id: template.id,
      name: name || template.name,
      description: template.description,
      source_type: template.type,
      base_url: resolvedBaseUrl || '',
      spec_content: specContent,
      spec_url: template.spec_url || null,
      spec_hash: specHash,
      auth_type: template.auth_type,
      auth_config: template.auth_config || {},
      mcp_server_uri: sourceMcpUri,
      mcp_transport: sourceMcpTransport,
      mcp_env: sourceMcpEnv,
      last_synced_at: new Date().toISOString(),
    };

    const { data: source, error: sourceError } = await supabase
      .from('api_sources')
      .insert(sourceData)
      .select()
      .single();

    if (sourceError) throw sourceError;

    // Save user credentials
    const { error: credError } = await supabase.from('user_api_credentials').upsert(
      {
        user_id: user.id,
        source_id: source.id,
        credentials: formattedCredentials,
      },
      { onConflict: 'user_id,source_id' }
    );

    if (credError) {
      console.error('[TEMPLATES] Credentials save error:', credError);
    }

    // Insert tools
    let toolCount = 0;
    if (parsedTools.length > 0) {
      const toolRows = parsedTools.map((t) => ({
        source_id: source.id,
        operation_id: t.operation_id,
        name: t.name,
        description: t.description,
        method: t.method,
        path: t.path,
        parameters: t.parameters || {},
        request_body: t.request_body || null,
        mcp_tool_name: t.mcp_tool_name || null,
        risk_level: t.risk_level,
        requires_confirmation: t.requires_confirmation,
        tags: t.tags || [],
      }));

      const { data: insertedTools, error: toolsError } = await supabase
        .from('tools')
        .insert(toolRows)
        .select('id');

      if (toolsError) {
        console.error('[TEMPLATES] Tools insert error:', toolsError);
      } else {
        toolCount = insertedTools?.length || 0;
      }
    }

    // Link source to user's workspace agent
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', 'Workspace')
      .single();

    if (agent) {
      await supabase.from('agent_sources').upsert(
        {
          agent_id: agent.id,
          source_id: source.id,
          permission: 'read_write',
        },
        { onConflict: 'agent_id,source_id' }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        source: {
          ...source,
          tool_count: toolCount,
        },
        message: `${template.name} connected — ${toolCount} endpoints available`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[TEMPLATES] Install Error:', error);
    return NextResponse.json(
      { error: 'Failed to install template', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Validate credentials based on template auth type
 */
function validateCredentials(template, credentials) {
  const authConfig = template.auth_config || {};

  switch (template.auth_type) {
    case 'bearer': {
      // Support both 'token' and custom credential_field (e.g., 'api_key' for Stripe)
      const credField = authConfig.credential_field || 'token';
      if (!credentials[credField]) {
        return `${authConfig.credential_label || 'Token'} is required`;
      }
      break;
    }

    case 'api_key':
      if (!credentials.api_key) {
        return `${authConfig.credential_label || 'API Key'} is required`;
      }
      break;

    case 'basic':
      if (!credentials.username) {
        return `${authConfig.username_label || 'Username'} is required`;
      }
      break;

    case 'header':
      if (authConfig.credential_fields) {
        for (const field of authConfig.credential_fields) {
          if (!credentials[field]) {
            return `${field} is required`;
          }
        }
      }
      break;

    case 'none':
      // Check for env var requirements (e.g., MCP connection strings)
      if (authConfig.env_var && authConfig.credential_field) {
        if (!credentials[authConfig.credential_field]) {
          return `${authConfig.credential_label || authConfig.credential_field} is required`;
        }
      }
      break;
  }

  return null;
}

/**
 * Format credentials for storage in user_api_credentials
 */
function formatCredentials(template, credentials) {
  const authConfig = template.auth_config || {};

  switch (template.auth_type) {
    case 'bearer': {
      // Support both 'token' and custom credential_field
      const credField = authConfig.credential_field || 'token';
      return {
        token: credentials[credField],
      };
    }

    case 'api_key':
      return {
        api_key: credentials.api_key,
        header_name: authConfig.header || 'X-API-Key',
      };

    case 'basic':
      return {
        username: credentials.username,
        password: credentials.password || '',
      };

    case 'header':
      return credentials;

    case 'none':
      // For MCP, store env vars
      if (authConfig.env_var && authConfig.credential_field) {
        return {
          env_vars: {
            [authConfig.env_var]: credentials[authConfig.credential_field],
          },
        };
      }
      return {};

    default:
      return credentials;
  }
}

/**
 * Resolve base URL placeholders like {subdomain}, {project_ref}, etc.
 */
function resolveBaseUrl(baseUrl, body) {
  if (!baseUrl) return '';

  let resolved = baseUrl;

  // Common placeholders
  const placeholders = ['subdomain', 'project_ref', 'store', 'tenant', 'org', 'domain'];

  for (const placeholder of placeholders) {
    const pattern = new RegExp(`\\{${placeholder}\\}`, 'g');
    if (resolved.match(pattern) && body[placeholder]) {
      resolved = resolved.replace(pattern, body[placeholder]);
    }
  }

  return resolved;
}
