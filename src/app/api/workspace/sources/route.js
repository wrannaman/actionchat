import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { parseOpenApiSpec } from '@/lib/tools';

export const dynamic = 'force-dynamic';

const WORKSPACE_AGENT_NAME = '__workspace__';

/**
 * POST /api/workspace/sources — Add an API source to the workspace
 *
 * Body: { spec_url } OR { spec_content } OR { name } (manual)
 *
 * This creates the source, parses tools, and auto-links to workspace agent.
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const body = await request.json();
    const { spec_url, spec_content, name: manualName } = body;

    // Get or create workspace agent
    let { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', WORKSPACE_AGENT_NAME)
      .single();

    if (!agent) {
      const { data: newAgent, error } = await supabase
        .from('agents')
        .insert({
          org_id: orgId,
          name: WORKSPACE_AGENT_NAME,
          description: 'Default workspace agent',
          system_prompt: 'You are a helpful operations assistant. Be concise. Always include IDs in your responses.',
          model_provider: 'openai',
          model_name: 'gpt-5-mini',
          temperature: 0.1,
        })
        .select('id')
        .single();
      if (error) throw error;
      agent = newAgent;
    }

    let resolvedSpec = spec_content;
    let resolvedUrl = spec_url;

    // If URL provided, fetch the spec
    if (spec_url && !spec_content) {
      try {
        const res = await fetch(spec_url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          return NextResponse.json(
            { error: `Failed to fetch spec: ${res.status} ${res.statusText}` },
            { status: 400 }
          );
        }
        resolvedSpec = await res.json();
      } catch (fetchError) {
        return NextResponse.json(
          { error: 'Failed to fetch spec', details: fetchError.message },
          { status: 400 }
        );
      }
    }

    // Manual source (no spec)
    if (!resolvedSpec && manualName) {
      const { data: source, error: sourceError } = await supabase
        .from('api_sources')
        .insert({
          org_id: orgId,
          name: manualName.trim(),
          source_type: 'manual',
          auth_type: 'passthrough',
        })
        .select('id, name')
        .single();

      if (sourceError) throw sourceError;

      // Link to workspace
      await supabase.from('agent_sources').insert({
        agent_id: agent.id,
        source_id: source.id,
        permission: 'read_write',
      });

      return NextResponse.json({
        ok: true,
        source: { ...source, tool_count: 0 },
      }, { status: 201 });
    }

    // Parse OpenAPI spec
    if (!resolvedSpec) {
      return NextResponse.json(
        { error: 'Provide spec_url, spec_content, or name for manual source' },
        { status: 400 }
      );
    }

    let parsed;
    try {
      parsed = parseOpenApiSpec(resolvedSpec);
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid OpenAPI spec', details: parseError.message },
        { status: 400 }
      );
    }

    const { source_meta, tools: parsedTools } = parsed;

    // Create the source
    const { data: source, error: sourceError } = await supabase
      .from('api_sources')
      .insert({
        org_id: orgId,
        name: source_meta.title || 'Untitled API',
        description: source_meta.description || '',
        base_url: source_meta.base_url || '',
        source_type: 'openapi',
        auth_type: 'passthrough',
        spec_content: resolvedSpec,
        spec_url: resolvedUrl || null,
        spec_hash: source_meta.spec_hash,
        last_synced_at: new Date().toISOString(),
      })
      .select('id, name, description, base_url')
      .single();

    if (sourceError) throw sourceError;

    // Insert tools
    let toolCount = 0;
    if (parsedTools.length > 0) {
      const toolRows = parsedTools.map(t => ({
        source_id: source.id,
        operation_id: t.operation_id,
        name: t.name,
        description: t.description,
        method: t.method,
        path: t.path,
        parameters: t.parameters || {},
        request_body: t.request_body || null,
        risk_level: t.risk_level,
        requires_confirmation: t.requires_confirmation,
        tags: t.tags || [],
      }));

      const { data: inserted, error: toolsError } = await supabase
        .from('tools')
        .insert(toolRows)
        .select('id');

      if (toolsError) {
        console.error('[WORKSPACE] Tools insert error:', toolsError);
      } else {
        toolCount = inserted?.length || 0;
      }
    }

    // Link to workspace agent
    await supabase.from('agent_sources').insert({
      agent_id: agent.id,
      source_id: source.id,
      permission: 'read_write',
    });

    return NextResponse.json({
      ok: true,
      source: {
        id: source.id,
        name: source.name,
        description: source.description,
        base_url: source.base_url,
        tool_count: toolCount,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[WORKSPACE] POST sources Error:', error);
    return NextResponse.json(
      { error: 'Failed to add source', details: error.message },
      { status: 500 }
    );
  }
}
