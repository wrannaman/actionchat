-- ============================================================================
-- ActionChat — Seed Integration Templates
--
-- Run this after 001.sql to populate the source_templates table.
-- Then run: npm run sync-templates to populate template_tools.
--
-- MCP templates (is_synced=true) load tools at runtime.
-- OpenAPI templates (is_synced=false) need syncing via npm run sync-templates.
-- ============================================================================

INSERT INTO source_templates (id, slug, name, description, category, logo_url, docs_url, source_type, base_url, spec_url, mcp_server_url, mcp_transport, auth_type, auth_config, use_cases, is_featured, is_synced)
VALUES
  -- ============================================================================
  -- TIER 1: Featured Integrations
  -- ============================================================================

  -- Stripe (OpenAPI) - FLAGSHIP
  ('2e059b2b-9cef-4440-bf7f-be6d6eeb9160', 'stripe', 'Stripe', 'Payment processing platform for internet businesses', 'payments', '/integrations/stripe.svg', 'https://docs.stripe.com/api', 'openapi', 'https://api.stripe.com', 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json', NULL, NULL, 'bearer', '{"credential_field": "api_key", "credential_label": "Secret Key", "credential_placeholder": "sk_test_... or sk_live_..."}', ARRAY['Refund a customer', 'Create invoice', 'Cancel subscription', 'List customers', 'Get customer by email'], true, false),

  -- Notion (HTTP MCP) - loads tools at runtime
  ('d48c08cb-3e87-4b03-9608-7a5799285c20', 'notion', 'Notion', 'All-in-one workspace for notes, docs, and databases', 'productivity', '/integrations/notion.svg', 'https://developers.notion.com/docs/mcp', 'mcp', NULL, NULL, 'https://mcp.notion.com/mcp', 'http', 'oauth', '{"provider": "notion"}', ARRAY['Create a page', 'Update a database', 'Query records', 'Add a comment', 'Search content'], true, true),

  -- Linear (HTTP MCP) - loads tools at runtime
  ('f3b89547-fdaa-4cd7-8730-58ffe454c4e5', 'linear', 'Linear', 'Issue tracking and project management for software teams', 'project_management', '/integrations/linear.svg', 'https://linear.app/docs/mcp', 'mcp', NULL, NULL, 'https://mcp.linear.app/sse', 'http', 'oauth', '{"provider": "linear"}', ARRAY['Create an issue', 'Update ticket status', 'Assign to team member', 'Add a comment', 'Create a project'], true, true),

  -- HubSpot (HTTP MCP) - loads tools at runtime
  ('62334fa1-77cd-437b-956a-15886386c5a2', 'hubspot', 'HubSpot', 'CRM and marketing automation platform', 'crm', '/integrations/hubspot.svg', 'https://developers.hubspot.com/mcp', 'mcp', NULL, NULL, 'https://mcp.hubspot.com', 'http', 'oauth', '{"provider": "hubspot"}', ARRAY['Create a contact', 'Update a deal', 'Send an email', 'Log an activity', 'Create a company'], true, true),

  -- Jira/Atlassian (HTTP MCP) - loads tools at runtime
  ('242c7d2f-590e-4da5-8324-0f1e44178921', 'jira', 'Jira', 'Issue and project tracking for agile teams', 'project_management', '/integrations/jira.svg', 'https://www.atlassian.com/blog/announcements/remote-mcp-server', 'mcp', NULL, NULL, 'https://mcp.atlassian.com', 'http', 'oauth', '{"provider": "atlassian"}', ARRAY['Create a ticket', 'Transition issue status', 'Add a comment', 'Assign to user', 'Update priority'], true, true),

  -- ============================================================================
  -- TIER 2: OpenAPI Integrations (need syncing)
  -- ============================================================================

  -- Slack
  ('e3249c17-f7ff-42af-bd5d-433a86c6ee5a', 'slack', 'Slack', 'Business communication platform for teams', 'communication', '/integrations/slack.svg', 'https://api.slack.com/methods', 'openapi', 'https://slack.com/api', 'https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Bot Token", "credential_placeholder": "xoxb-..."}', ARRAY['Post a message', 'Create a channel', 'Invite user to channel', 'Upload a file'], false, false),

  -- SendGrid
  ('730ce519-a862-4b2b-86f9-96a41817e77c', 'sendgrid', 'SendGrid', 'Email delivery platform for transactional and marketing emails', 'communication', '/integrations/sendgrid.svg', 'https://docs.sendgrid.com/api-reference', 'openapi', 'https://api.sendgrid.com', 'https://raw.githubusercontent.com/twilio/sendgrid-oai/main/oai.json', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "SG...."}', ARRAY['Send an email', 'Manage contacts', 'Check bounce list', 'Create email template'], false, false),

  -- Cloudflare
  ('67f9d620-694d-4d5e-8f28-95b1942925fe', 'cloudflare', 'Cloudflare', 'Web performance and security services', 'infrastructure', '/integrations/cloudflare.svg', 'https://developers.cloudflare.com/api', 'openapi', 'https://api.cloudflare.com/client/v4', 'https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Token", "credential_placeholder": "Your API token"}', ARRAY['Purge cache', 'Update DNS record', 'Create a Worker', 'List zones'], false, false),

  -- Zendesk (no spec_url - manual setup)
  ('395a460e-cf1b-4eab-83e4-792249b6c5c7', 'zendesk', 'Zendesk', 'Customer service and engagement platform', 'support', '/integrations/zendesk.svg', 'https://developer.zendesk.com/api-reference', 'openapi', NULL, NULL, NULL, NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "Email/token", "password_label": "API Token"}', ARRAY['Create a ticket', 'Update ticket status', 'Add internal note', 'Assign to agent'], false, false),

  -- Intercom
  ('1c26d33f-bf9a-4049-8534-64d89261bbeb', 'intercom', 'Intercom', 'Customer messaging platform for sales and support', 'support', '/integrations/intercom.svg', 'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/', 'openapi', 'https://api.intercom.io', 'https://raw.githubusercontent.com/intercom/Intercom-OpenAPI/main/descriptions/2.11/api.intercom.io.yaml', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Access Token"}', ARRAY['Create a conversation', 'Send a message', 'Update user attributes', 'Add a tag'], false, false)

ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  logo_url = EXCLUDED.logo_url,
  docs_url = EXCLUDED.docs_url,
  source_type = EXCLUDED.source_type,
  base_url = EXCLUDED.base_url,
  spec_url = EXCLUDED.spec_url,
  mcp_server_url = EXCLUDED.mcp_server_url,
  mcp_transport = EXCLUDED.mcp_transport,
  auth_type = EXCLUDED.auth_type,
  auth_config = EXCLUDED.auth_config,
  use_cases = EXCLUDED.use_cases,
  is_featured = EXCLUDED.is_featured,
  updated_at = now();
