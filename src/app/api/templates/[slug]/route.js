import { NextResponse } from 'next/server';
import integrationsData from '../../../../../docs/integrations.json';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates/[slug] — Get detailed template information
 */
export async function GET(request, { params }) {
  try {
    const { slug } = await params;

    const template = integrationsData.integrations.find((i) => i.slug === slug);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Return full template details including auth config
    const response = {
      id: template.id,
      slug: template.slug,
      name: template.name,
      description: template.description,
      category: template.category,
      type: template.type,
      spec_url: template.spec_url,
      base_url: template.base_url,
      mcp_package: template.mcp_package,
      logo_url: template.logo_url,
      docs_url: template.docs_url,
      use_cases: template.use_cases,
      is_featured: template.is_featured,
      auth_type: template.auth_type,
      auth_config: template.auth_config,
    };

    return NextResponse.json({ ok: true, template: response });
  } catch (error) {
    console.error('[TEMPLATES] GET [slug] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get template', details: error.message },
      { status: 500 }
    );
  }
}
