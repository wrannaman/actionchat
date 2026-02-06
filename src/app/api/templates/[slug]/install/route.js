import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getPermissions, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/[slug]/install — Install a template as a new source
 *
 * Template-based sources use global template_tools (no per-org tools table).
 * This endpoint just creates the api_sources entry and stores user credentials.
 *
 * Body: {
 *   credentials: { ... },  // Auth credentials for the API
 *   name?: string,         // Override source name
 *   base_url?: string,     // Override base URL (for placeholders)
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

    // Get template from database (not local JSON)
    const { data: template, error: templateError } = await supabase
      .from('source_templates')
      .select('*')
      .eq('slug', slug)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if template tools are synced (for OpenAPI templates)
    if (template.source_type === 'openapi' && !template.is_synced) {
      const { count: toolCount } = await supabase
        .from('template_tools')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', template.id)
        .eq('is_active', true);

      if (!toolCount || toolCount === 0) {
        return NextResponse.json({
          error: 'Template not ready',
          message: `The ${template.name} template has not been synced yet. Please contact your administrator to run: npm run sync-templates`,
          template_id: template.id,
        }, { status: 400 });
      }
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

    // Format credentials for storage
    const formattedCredentials = formatCredentials(template, credentials);

    // Determine MCP config for source storage (HTTP only)
    let sourceMcpUri = null;
    let sourceMcpTransport = null;

    if (template.source_type === 'mcp') {
      // Only HTTP MCP is supported
      if (!template.mcp_server_url) {
        return NextResponse.json({
          error: 'MCP integration not available',
          message: 'This integration requires a remote MCP server URL which is not configured.',
        }, { status: 400 });
      }
      sourceMcpUri = template.mcp_server_url;
      sourceMcpTransport = 'http';
    }

    // Check if user already has this source
    const { data: existingSource } = await supabase
      .from('api_sources')
      .select('id')
      .eq('org_id', orgId)
      .eq('template_id', template.id)
      .single();

    if (existingSource) {
      // Update credentials instead of creating duplicate
      await supabase
        .from('user_api_credentials')
        .upsert({
          user_id: user.id,
          source_id: existingSource.id,
          label: 'Default',
          credentials: formattedCredentials,
          is_active: true,
        }, { onConflict: 'user_id,source_id,label' });

      // Get tool count from template_tools
      const { count: toolCount } = await supabase
        .from('template_tools')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', template.id)
        .eq('is_active', true);

      return NextResponse.json({
        ok: true,
        source: { ...existingSource, tool_count: toolCount || 0 },
        message: `${template.name} credentials updated`,
      });
    }

    // Create the source (links to template via template_id)
    const sourceData = {
      org_id: orgId,
      template_id: template.id,
      name: name || template.name,
      description: template.description,
      source_type: template.source_type,
      base_url: resolvedBaseUrl || template.base_url || '',
      spec_url: template.spec_url || null,
      auth_type: template.auth_type,
      auth_config: template.auth_config || {},
      mcp_server_uri: sourceMcpUri,
      mcp_transport: sourceMcpTransport,
      is_active: true,
    };

    const { data: source, error: sourceError } = await supabase
      .from('api_sources')
      .insert(sourceData)
      .select()
      .single();

    if (sourceError) throw sourceError;

    // Save user credentials
    const { error: credError } = await supabase.from('user_api_credentials').insert({
      user_id: user.id,
      source_id: source.id,
      label: 'Default',
      credentials: formattedCredentials,
      is_active: true,
    });

    if (credError) {
      console.error('[TEMPLATES] Credentials save error:', credError);
    }

    // Link source to user's workspace agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', '__workspace__')
      .single();

    if (agentError) {
      console.error('[TEMPLATES] Workspace agent lookup error:', agentError);
    }

    if (agent) {
      const { error: linkError } = await supabase.from('agent_sources').upsert({
        agent_id: agent.id,
        source_id: source.id,
        permission: 'read_write',
      }, { onConflict: 'agent_id,source_id' });

      if (linkError) {
        console.error('[TEMPLATES] Agent-source link error:', linkError);
      }
    } else {
      console.warn('[TEMPLATES] No workspace agent found for org:', orgId);
    }

    // Get tool count from template_tools (not per-org tools)
    const { count: toolCount } = await supabase
      .from('template_tools')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', template.id)
      .eq('is_active', true);

    return NextResponse.json({
      ok: true,
      source: {
        ...source,
        tool_count: toolCount || 0,
      },
      message: `${template.name} connected — ${toolCount || 0} endpoints available`,
    }, { status: 201 });
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

    case 'oauth':
      // OAuth templates need a token from the OAuth flow
      if (!credentials.access_token && !credentials.token) {
        return 'OAuth authorization required';
      }
      break;

    case 'none':
      // No credentials required
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
      const credField = authConfig.credential_field || 'token';
      return { token: credentials[credField] };
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

    case 'oauth':
      return {
        access_token: credentials.access_token || credentials.token,
        refresh_token: credentials.refresh_token,
      };

    case 'none':
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
  const placeholders = ['subdomain', 'project_ref', 'store', 'tenant', 'org', 'domain'];

  for (const placeholder of placeholders) {
    const pattern = new RegExp(`\\{${placeholder}\\}`, 'g');
    if (resolved.match(pattern) && body[placeholder]) {
      resolved = resolved.replace(pattern, body[placeholder]);
    }
  }

  return resolved;
}
