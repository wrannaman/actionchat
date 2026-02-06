#!/usr/bin/env node
/**
 * Sync Template Tools
 *
 * Platform-level script to sync all OpenAPI template tools.
 * Run this after database setup to populate template_tools.
 *
 * Usage:
 *   node scripts/sync-templates.mjs
 *   node scripts/sync-templates.mjs --template=stripe  # Sync specific template
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *   - OPENAI_API_KEY (or other embedding provider) for embeddings
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parseOpenApiSpec } from '../src/lib/tools/openapi-parser.js';

// Load env vars BEFORE importing ai.js (which reads env at module load)
config();

// Dynamic import to ensure env vars are loaded first
const { generateEmbedding, getEmbeddingConfig } = await import('../src/lib/ai.js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse CLI args
const args = process.argv.slice(2);
const templateSlug = args.find(a => a.startsWith('--template='))?.split('=')[1];
const skipEmbeddings = args.includes('--skip-embeddings');

async function syncTemplate(template) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Syncing: ${template.name} (${template.slug})`);
  console.log(`${'═'.repeat(60)}`);

  // MCP templates don't need syncing - they load tools at runtime
  if (template.source_type === 'mcp') {
    console.log('  → MCP template, skipping (tools load at runtime)');
    await supabase
      .from('source_templates')
      .update({ is_synced: true })
      .eq('id', template.id);
    return { skipped: true, reason: 'mcp' };
  }

  // Need spec_url for OpenAPI templates
  if (!template.spec_url) {
    console.log('  → No spec_url, skipping');
    return { skipped: true, reason: 'no_spec_url' };
  }

  // Fetch the spec
  console.log(`  → Fetching spec from: ${template.spec_url}`);
  let specContent;
  try {
    const res = await fetch(template.spec_url, {
      headers: { Accept: 'application/json, application/yaml, text/yaml' },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.error(`  ✗ Failed to fetch: ${res.status} ${res.statusText}`);
      return { error: `fetch_failed: ${res.status}` };
    }
    const text = await res.text();
    // Try to parse as JSON, fall back to assuming it's already JSON
    try {
      specContent = JSON.parse(text);
    } catch {
      // Might be YAML - for now, skip YAML specs
      console.error('  ✗ Spec is not JSON (YAML not supported yet)');
      return { error: 'yaml_not_supported' };
    }
  } catch (err) {
    console.error(`  ✗ Fetch error: ${err.message}`);
    return { error: err.message };
  }

  // Parse the spec
  console.log('  → Parsing OpenAPI spec...');
  let parsed;
  try {
    parsed = parseOpenApiSpec(specContent);
  } catch (err) {
    console.error(`  ✗ Parse error: ${err.message}`);
    return { error: `parse_failed: ${err.message}` };
  }
  console.log(`  → Found ${parsed.tools.length} tools`);

  // Clear existing tools for this template
  const { error: deleteError } = await supabase
    .from('template_tools')
    .delete()
    .eq('template_id', template.id);

  if (deleteError) {
    console.error(`  ✗ Failed to clear existing tools: ${deleteError.message}`);
    return { error: deleteError.message };
  }

  // Insert tools
  const toolsToInsert = parsed.tools.map(tool => ({
    template_id: template.id,
    operation_id: tool.operation_id,
    name: tool.name,
    description: tool.description,
    method: tool.method,
    path: tool.path,
    parameters: tool.parameters || {},
    request_body: tool.request_body || null,
    risk_level: tool.risk_level,
    requires_confirmation: tool.requires_confirmation,
    tags: tool.tags || [],
    is_active: true,
  }));

  const { data: insertedTools, error: insertError } = await supabase
    .from('template_tools')
    .insert(toolsToInsert)
    .select('id, name, description, method, path');

  if (insertError) {
    console.error(`  ✗ Insert error: ${insertError.message}`);
    return { error: insertError.message };
  }
  console.log(`  ✓ Inserted ${insertedTools.length} tools`);

  // Generate embeddings
  let embeddedCount = 0;
  if (!skipEmbeddings && insertedTools.length > 0) {
    const { column } = getEmbeddingConfig();
    console.log(`  → Generating embeddings (${column})...`);

    const CONCURRENCY = 10;
    for (let i = 0; i < insertedTools.length; i += CONCURRENCY) {
      const batch = insertedTools.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (tool) => {
          try {
            const text = `${tool.name}: ${tool.description || ''} (${tool.method} ${tool.path})`;
            const embedding = await generateEmbedding(text);
            await supabase
              .from('template_tools')
              .update({ [column]: embedding })
              .eq('id', tool.id);
            return true;
          } catch (e) {
            // Log first few errors, then continue silently
            if (embeddedCount === 0 && i < 30) {
              console.error(`\n  ✗ Embedding error for ${tool.name}: ${e.message}`);
            }
            return false;
          }
        })
      );
      embeddedCount += results.filter(Boolean).length;

      // Progress log
      const progress = Math.min(i + CONCURRENCY, insertedTools.length);
      process.stdout.write(`\r  → Embedded ${embeddedCount}/${progress} tools`);
    }
    console.log(''); // newline after progress
  }

  // Cache spec content and mark as synced
  await supabase
    .from('source_templates')
    .update({
      spec_content: specContent,
      is_synced: true,
    })
    .eq('id', template.id);

  console.log(`  ✓ Complete: ${insertedTools.length} tools, ${embeddedCount} embeddings`);

  return {
    tools: insertedTools.length,
    embeddings: embeddedCount,
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          ActionChat Template Sync                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Get templates to sync
  let query = supabase.from('source_templates').select('*');

  if (templateSlug) {
    query = query.eq('slug', templateSlug);
  } else {
    // Only sync OpenAPI templates that haven't been synced
    query = query.eq('source_type', 'openapi').eq('is_synced', false);
  }

  const { data: templates, error } = await query;

  if (error) {
    console.error('Failed to fetch templates:', error.message);
    process.exit(1);
  }

  if (templates.length === 0) {
    console.log('\nNo templates need syncing.');
    if (!templateSlug) {
      console.log('Use --template=<slug> to force sync a specific template.');
    }
    process.exit(0);
  }

  console.log(`\nFound ${templates.length} template(s) to sync`);
  if (skipEmbeddings) {
    console.log('⚠ Embeddings disabled (--skip-embeddings)');
  }

  const results = {};
  for (const template of templates) {
    results[template.slug] = await syncTemplate(template);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));

  let totalTools = 0;
  let totalEmbeddings = 0;

  for (const [slug, result] of Object.entries(results)) {
    if (result.skipped) {
      console.log(`  ${slug}: skipped (${result.reason})`);
    } else if (result.error) {
      console.log(`  ${slug}: ✗ error - ${result.error}`);
    } else {
      console.log(`  ${slug}: ✓ ${result.tools} tools, ${result.embeddings} embeddings`);
      totalTools += result.tools;
      totalEmbeddings += result.embeddings;
    }
  }

  console.log('─'.repeat(60));
  console.log(`Total: ${totalTools} tools, ${totalEmbeddings} embeddings`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
