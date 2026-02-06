import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { executeTool } from '@/lib/tools';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tools/paginate
 *
 * Silent tool execution for pagination - fetches next page without creating
 * a chat message. Used by the UI to enable seamless page navigation.
 *
 * Body: {
 *   toolId: string,        // The tool to execute
 *   input: object,         // Tool input params (with pagination params merged)
 *   sourceId: string,      // For credential lookup
 * }
 *
 * Returns the tool output directly, no message creation.
 */
export async function POST(request) {
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

    const body = await request.json();
    const { toolId, input, sourceId } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
    }

    // Try to fetch from tools table first (custom sources)
    let tool = null;
    let source = null;

    const { data: customTool, error: customToolError } = await supabase
      .from('tools')
      .select(`
        *,
        api_sources (
          id, name, base_url, auth_type, auth_config, source_type,
          mcp_server_uri, mcp_transport, mcp_env
        )
      `)
      .eq('id', toolId)
      .single();

    if (customTool) {
      tool = customTool;
      source = customTool.api_sources;
    } else {
      // Try template_tools table (template-based sources)
      const { data: templateTool, error: templateToolError } = await supabase
        .from('template_tools')
        .select('*')
        .eq('id', toolId)
        .single();

      if (templateTool) {
        // Get the source that uses this template
        const { data: templateSource } = await supabase
          .from('api_sources')
          .select('id, name, base_url, auth_type, auth_config, source_type, mcp_server_uri, mcp_transport, mcp_env')
          .eq('template_id', templateTool.template_id)
          .eq('org_id', orgId)
          .single();

        if (templateSource) {
          // Convert template_tool to tool format
          tool = {
            id: templateTool.id,
            name: templateTool.name,
            description: templateTool.description,
            method: templateTool.method,
            path: templateTool.path,
            parameters: templateTool.parameters,
            request_body: templateTool.request_body,
            risk_level: templateTool.risk_level,
            requires_confirmation: templateTool.requires_confirmation,
            mcp_tool_name: templateTool.mcp_tool_name,
          };
          source = templateSource;
        }
      }
    }

    if (!tool || !source) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }
    const { data: sourceAccess } = await supabase
      .from('api_sources')
      .select('id')
      .eq('id', source.id)
      .eq('org_id', orgId)
      .single();

    if (!sourceAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get user's active credentials for this source
    const { data: credential } = await supabase
      .from('user_api_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('source_id', source.id)
      .eq('is_active', true)
      .single();

    if (!credential) {
      return NextResponse.json(
        { error: 'No credentials found for this API' },
        { status: 400 }
      );
    }

    // Source already has source_type from the query
    const expandedSource = source;

    // Execute the tool
    const result = await executeTool({
      tool,
      source: expandedSource,
      args: input || {},
      userCredentials: credential.credentials,
      userId: user.id,
    });

    // Return the result with metadata in the format expected by the UI
    return NextResponse.json({
      ok: true,
      output: {
        _actionchat: {
          tool_id: toolId,
          tool_name: tool.name,
          source_id: source.id,
          source_name: source.name,
          method: tool.method || 'MCP',
          url: result.url,
          response_status: result.response_status,
          response_body: result.response_body,
          duration_ms: result.duration_ms,
          error_message: result.error_message,
          paginated: true,
        },
        result: result.response_body,
      },
    });
  } catch (error) {
    console.error('[PAGINATE] Error:', error);
    return NextResponse.json(
      { error: 'Pagination failed', details: error.message },
      { status: 500 }
    );
  }
}
