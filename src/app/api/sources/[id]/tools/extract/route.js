import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireAdmin } from '@/utils/permissions';
import { cookies } from 'next/headers';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ToolSchema = z.object({
  name: z.string().describe('Human-readable name for the endpoint, e.g. "Create Refund"'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).describe('HTTP method'),
  path: z.string().describe('URL path, e.g. "/v1/refunds" — extract from full URL if needed'),
  description: z.string().optional().describe('Brief description of what the endpoint does'),
  parameters: z.record(z.any()).optional().describe('JSON Schema for query/path parameters'),
  request_body: z.record(z.any()).optional().describe('JSON Schema for request body'),
  risk_level: z.enum(['safe', 'moderate', 'dangerous']).describe('safe for GET/HEAD, moderate for POST, dangerous for PUT/PATCH/DELETE'),
  requires_confirmation: z.boolean().describe('true for dangerous operations that modify/delete data'),
});

/**
 * POST /api/sources/[id]/tools/extract — Extract tool definition from natural language or cURL
 * Body: { input: "paste cURL, docs, or description here" }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const perms = await getPermissions(user.id, orgId);
    const adminErr = requireAdmin(perms);
    if (adminErr) return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });

    // Verify source belongs to org
    const { data: source } = await supabase
      .from('api_sources')
      .select('id, org_id, source_type, base_url')
      .eq('id', id)
      .single();

    if (!source || source.org_id !== orgId) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const body = await request.json();
    const { input } = body;

    if (!input || !input.trim()) {
      return NextResponse.json({ error: 'input is required' }, { status: 400 });
    }

    // Get org's OpenAI key
    const { data: org } = await supabase
      .from('org')
      .select('settings')
      .eq('id', orgId)
      .single();

    const apiKey = org?.settings?.openai_api_key;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add it in Settings.' },
        { status: 400 }
      );
    }

    // Use AI to extract tool definition
    const { object: tool } = await generateObject({
      model: openai('gpt-5-mini', { apiKey }),
      schema: ToolSchema,
      prompt: `Extract an API endpoint definition from the following input. The input might be:
- A cURL command
- API documentation text
- A natural language description
- Code snippets

If a full URL is provided, extract just the path portion (e.g., "https://api.stripe.com/v1/refunds" → "/v1/refunds").
For the parameters and request_body fields, generate JSON Schema objects describing the expected structure.
If the input doesn't contain enough info for a field, omit it or use sensible defaults.

Base URL context (if helpful): ${source.base_url || 'not set'}

Input to parse:
${input}`,
    });

    return NextResponse.json({ ok: true, tool });
  } catch (error) {
    console.error('[TOOL EXTRACT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extract tool definition', details: error.message },
      { status: 500 }
    );
  }
}
