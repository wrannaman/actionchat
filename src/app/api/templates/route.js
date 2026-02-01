import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import integrationsData from '../../../../docs/integrations.json';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates — List all available integration templates
 *
 * Query params:
 * - category: Filter by category (e.g., "payments", "devops")
 * - featured: If "true", only return featured integrations
 * - type: Filter by type ("openapi" or "mcp")
 * - search: Search by name or description
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured') === 'true';
    const type = searchParams.get('type');
    const search = searchParams.get('search')?.toLowerCase();

    let integrations = integrationsData.integrations;

    // Apply filters
    if (category) {
      integrations = integrations.filter((i) => i.category === category);
    }
    if (featured) {
      integrations = integrations.filter((i) => i.is_featured);
    }
    if (type) {
      integrations = integrations.filter((i) => i.type === type);
    }
    if (search) {
      integrations = integrations.filter(
        (i) =>
          i.name.toLowerCase().includes(search) ||
          i.description.toLowerCase().includes(search) ||
          i.use_cases.some((uc) => uc.toLowerCase().includes(search))
      );
    }

    // Try to get install counts from database if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let installCounts = {};
    if (user) {
      // Count how many times each template has been used
      const { data: sources } = await supabase
        .from('api_sources')
        .select('template_id')
        .not('template_id', 'is', null);

      if (sources) {
        for (const s of sources) {
          installCounts[s.template_id] = (installCounts[s.template_id] || 0) + 1;
        }
      }
    }

    // Map to response format
    const templates = integrations.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      description: i.description,
      category: i.category,
      type: i.type,
      tier: i.tier,
      logo_url: i.logo_url,
      docs_url: i.docs_url,
      use_cases: i.use_cases,
      is_featured: i.is_featured,
      auth_type: i.auth_type,
      auth_config: i.auth_config,
      base_url: i.base_url,
      install_count: installCounts[i.id] || 0,
    }));

    return NextResponse.json({
      ok: true,
      templates,
      categories: integrationsData.categories,
    });
  } catch (error) {
    console.error('[TEMPLATES] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list templates', details: error.message },
      { status: 500 }
    );
  }
}
