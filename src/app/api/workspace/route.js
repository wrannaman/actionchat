import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const WORKSPACE_AGENT_NAME = '__workspace__';
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful operations assistant. Be concise. Always include IDs in your responses.';

/**
 * GET /api/workspace — Get or create the user's workspace (default agent + attached APIs)
 *
 * The "workspace" is a hidden agent that auto-links all the user's APIs.
 * This simplifies the UX: user just adds APIs and chats.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    // Find or create workspace agent
    let { data: agent } = await supabase
      .from('agents')
      .select('id, name, system_prompt, model_provider, model_name, temperature')
      .eq('org_id', orgId)
      .eq('name', WORKSPACE_AGENT_NAME)
      .single();

    if (!agent) {
      // Create workspace agent
      const { data: newAgent, error: createError } = await supabase
        .from('agents')
        .insert({
          org_id: orgId,
          name: WORKSPACE_AGENT_NAME,
          description: 'Default workspace agent',
          system_prompt: DEFAULT_SYSTEM_PROMPT,
          model_provider: 'openai',
          model_name: 'gpt-5-mini',
          temperature: 0.1,
        })
        .select('id, name, system_prompt, model_provider, model_name, temperature')
        .single();

      if (createError) throw createError;
      agent = newAgent;
    }

    // Get org settings to check for API key
    const { data: org } = await supabase
      .from('org')
      .select('settings')
      .eq('id', orgId)
      .single();

    const orgSettings = org?.settings || {};
    const hasApiKey = !!(
      orgSettings.openai_api_key ||
      orgSettings.anthropic_api_key ||
      orgSettings.google_generative_ai_api_key ||
      orgSettings.ollama_base_url
    );

    // Get attached sources with tool counts
    const { data: links } = await supabase
      .from('agent_sources')
      .select('source_id, permission')
      .eq('agent_id', agent.id);

    const sourceIds = (links || []).map(l => l.source_id);
    let sources = [];

    if (sourceIds.length > 0) {
      const { data: sourcesData } = await supabase
        .from('api_sources')
        .select('id, name, description, base_url, source_type, auth_type, is_active, template_id')
        .in('id', sourceIds);

      // Separate template-based and custom sources
      const templateSources = (sourcesData || []).filter(s => s.template_id);
      const customSources = (sourcesData || []).filter(s => !s.template_id);

      const toolCounts = {};

      // Build parallel queries for tool counts
      const queries = [];

      if (customSources.length > 0) {
        const customSourceIds = customSources.map(s => s.id);
        queries.push(
          supabase
            .from('tools')
            .select('source_id')
            .in('source_id', customSourceIds)
            .eq('is_active', true)
            .then(({ data }) => ({ type: 'custom', data }))
        );
      }

      if (templateSources.length > 0) {
        const templateIds = [...new Set(templateSources.map(s => s.template_id))];
        queries.push(
          supabase
            .from('template_tools')
            .select('template_id')
            .in('template_id', templateIds)
            .eq('is_active', true)
            .then(({ data }) => ({ type: 'template', data }))
        );
      }

      // Execute queries in parallel
      const results = await Promise.all(queries);

      for (const result of results) {
        if (result.type === 'custom') {
          for (const t of (result.data || [])) {
            toolCounts[t.source_id] = (toolCounts[t.source_id] || 0) + 1;
          }
        } else if (result.type === 'template') {
          // Count tools per template
          const templateToolCounts = {};
          for (const t of (result.data || [])) {
            templateToolCounts[t.template_id] = (templateToolCounts[t.template_id] || 0) + 1;
          }
          // Map template counts to sources
          for (const s of templateSources) {
            toolCounts[s.id] = templateToolCounts[s.template_id] || 0;
          }
        }
      }

      sources = (sourcesData || []).map(s => ({
        ...s,
        tool_count: toolCounts[s.id] || 0,
        permission: links.find(l => l.source_id === s.id)?.permission || 'read_write',
      }));
    }

    return NextResponse.json({
      ok: true,
      workspace: {
        agent_id: agent.id,
        model_provider: agent.model_provider,
        model_name: agent.model_name,
        has_api_key: hasApiKey,
        sources,
      },
    });
  } catch (error) {
    console.error('[WORKSPACE] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get workspace', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspace — Update workspace settings (API key, model, etc.)
 */
export async function PATCH(request) {
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
    const { openai_api_key, openai_base_url, anthropic_api_key, google_generative_ai_api_key, ollama_base_url } = body;

    // Get current settings
    const { data: org } = await supabase
      .from('org')
      .select('settings')
      .eq('id', orgId)
      .single();

    const currentSettings = org?.settings || {};

    // Merge new settings (only update provided keys)
    const newSettings = { ...currentSettings };
    if (openai_api_key !== undefined) {
      newSettings.openai_api_key = openai_api_key || null;
    }
    if (openai_base_url !== undefined) {
      newSettings.openai_base_url = openai_base_url || null;
    }
    if (anthropic_api_key !== undefined) {
      newSettings.anthropic_api_key = anthropic_api_key || null;
    }
    if (google_generative_ai_api_key !== undefined) {
      newSettings.google_generative_ai_api_key = google_generative_ai_api_key || null;
    }
    if (ollama_base_url !== undefined) {
      newSettings.ollama_base_url = ollama_base_url || null;
    }

    // Update org settings
    const { error } = await supabase
      .from('org')
      .update({ settings: newSettings })
      .eq('id', orgId);

    if (error) throw error;

    const hasApiKey = !!(
      newSettings.openai_api_key ||
      newSettings.anthropic_api_key ||
      newSettings.google_generative_ai_api_key ||
      newSettings.ollama_base_url
    );

    return NextResponse.json({
      ok: true,
      has_api_key: hasApiKey,
    });
  } catch (error) {
    console.error('[WORKSPACE] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update workspace', details: error.message },
      { status: 500 }
    );
  }
}
