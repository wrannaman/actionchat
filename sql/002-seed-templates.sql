-- ============================================================================
-- ActionChat — Seed Integration Templates
--
-- Run this after 001.sql to populate the source_templates table.
-- Uses ON CONFLICT to allow re-running without duplicates.
-- ============================================================================

INSERT INTO source_templates (id, slug, name, description, category, logo_url, docs_url, source_type, spec_url, mcp_package, mcp_server_url, mcp_transport, auth_type, auth_config, use_cases, is_featured)
VALUES
  -- ============================================================================
  -- TIER 1: HTTP MCP Integrations (Browser-native, no process spawning)
  -- ============================================================================

  -- Stripe (HTTP MCP) - FLAGSHIP
  ('2e059b2b-9cef-4440-bf7f-be6d6eeb9160', 'stripe', 'Stripe', 'Payment processing platform for internet businesses', 'payments', '/integrations/stripe.svg', 'https://docs.stripe.com/mcp', 'mcp', NULL, NULL, 'https://mcp.stripe.com', 'http', 'bearer', '{"credential_field": "api_key", "credential_label": "Secret Key", "credential_placeholder": "sk_test_... or sk_live_..."}', ARRAY['Refund a customer', 'Create invoice', 'Cancel subscription', 'List customers', 'Search documentation'], true),

  -- Notion (HTTP MCP)
  ('d48c08cb-3e87-4b03-9608-7a5799285c20', 'notion', 'Notion', 'All-in-one workspace for notes, docs, and databases', 'productivity', '/integrations/notion.svg', 'https://developers.notion.com/docs/mcp', 'mcp', NULL, NULL, 'https://mcp.notion.com/mcp', 'http', 'oauth', '{"provider": "notion"}', ARRAY['Create a page', 'Update a database', 'Query records', 'Add a comment', 'Search content'], true),

  -- Linear (HTTP MCP)
  ('f3b89547-fdaa-4cd7-8730-58ffe454c4e5', 'linear', 'Linear', 'Issue tracking and project management for software teams', 'project_management', '/integrations/linear.svg', 'https://linear.app/docs/mcp', 'mcp', NULL, NULL, 'https://mcp.linear.app/sse', 'http', 'oauth', '{"provider": "linear"}', ARRAY['Create an issue', 'Update ticket status', 'Assign to team member', 'Add a comment', 'Create a project'], true),

  -- HubSpot (HTTP MCP)
  ('62334fa1-77cd-437b-956a-15886386c5a2', 'hubspot', 'HubSpot', 'CRM and marketing automation platform', 'crm', '/integrations/hubspot.svg', 'https://developers.hubspot.com/mcp', 'mcp', NULL, NULL, 'https://mcp.hubspot.com', 'http', 'oauth', '{"provider": "hubspot"}', ARRAY['Create a contact', 'Update a deal', 'Send an email', 'Log an activity', 'Create a company'], true),

  -- Jira/Atlassian (HTTP MCP)
  ('242c7d2f-590e-4da5-8324-0f1e44178921', 'jira', 'Jira', 'Issue and project tracking for agile teams', 'project_management', '/integrations/jira.svg', 'https://www.atlassian.com/blog/announcements/remote-mcp-server', 'mcp', NULL, NULL, 'https://mcp.atlassian.com', 'http', 'oauth', '{"provider": "atlassian"}', ARRAY['Create a ticket', 'Transition issue status', 'Add a comment', 'Assign to user', 'Update priority'], true),

  -- ============================================================================
  -- TIER 2: OpenAPI Integrations (REST APIs with specs)
  -- ============================================================================

  -- Slack
  ('e3249c17-f7ff-42af-bd5d-433a86c6ee5a', 'slack', 'Slack', 'Business communication platform for teams', 'communication', '/integrations/slack.svg', 'https://api.slack.com/methods', 'openapi', 'https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json', NULL, NULL, 'stdio', 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Bot Token", "credential_placeholder": "xoxb-..."}', ARRAY['Post a message', 'Create a channel', 'Invite user to channel', 'Upload a file', 'Set channel topic'], false),

  -- SendGrid
  ('730ce519-a862-4b2b-86f9-96a41817e77c', 'sendgrid', 'SendGrid', 'Email delivery platform for transactional and marketing emails', 'communication', '/integrations/sendgrid.svg', 'https://docs.sendgrid.com/api-reference', 'openapi', 'https://raw.githubusercontent.com/twilio/sendgrid-oai/main/oai.json', NULL, NULL, 'stdio', 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "SG...."}', ARRAY['Send an email', 'Manage contacts', 'Check bounce list', 'Create email template', 'View email statistics'], false),

  -- Cloudflare
  ('67f9d620-694d-4d5e-8f28-95b1942925fe', 'cloudflare', 'Cloudflare', 'Web performance and security services', 'infrastructure', '/integrations/cloudflare.svg', 'https://developers.cloudflare.com/api', 'openapi', 'https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json', NULL, NULL, 'stdio', 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Token", "credential_placeholder": "Your Cloudflare API token"}', ARRAY['Purge cache', 'Update DNS record', 'Create a Worker', 'List zones', 'Enable WAF rule'], false),

  -- Zendesk
  ('395a460e-cf1b-4eab-83e4-792249b6c5c7', 'zendesk', 'Zendesk', 'Customer service and engagement platform', 'support', '/integrations/zendesk.svg', 'https://developer.zendesk.com/api-reference', 'openapi', NULL, NULL, NULL, 'stdio', 'basic', '{"credential_fields": ["username", "password"], "username_label": "Email/token", "username_placeholder": "email@domain.com/token", "password_label": "API Token", "password_placeholder": "Your Zendesk API token"}', ARRAY['Create a ticket', 'Update ticket status', 'Add internal note', 'Assign to agent', 'Close ticket'], false),

  -- Intercom
  ('1c26d33f-bf9a-4049-8534-64d89261bbeb', 'intercom', 'Intercom', 'Customer messaging platform for sales and support', 'support', '/integrations/intercom.svg', 'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/', 'openapi', 'https://raw.githubusercontent.com/intercom/Intercom-OpenAPI/main/descriptions/2.11/api.intercom.io.yaml', NULL, NULL, 'stdio', 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Access Token", "credential_placeholder": "dG9rOi..."}', ARRAY['Create a conversation', 'Send a message', 'Update user attributes', 'Add a tag', 'Close conversation'], false)

  -- ============================================================================
  -- COMMENTED OUT (uncomment to add more integrations)
  -- ============================================================================

  -- -- Twilio
  -- ('204bee05-541e-4161-a9b5-4fd36d1b843c', 'twilio', 'Twilio', 'Cloud communications platform for SMS, voice, and video', 'communication', '/integrations/twilio.svg', 'https://www.twilio.com/docs/api', 'openapi', 'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json', NULL, NULL, 'stdio', 'basic', '{"credential_fields": ["username", "password"], "username_label": "Account SID", "username_placeholder": "AC...", "password_label": "Auth Token", "password_placeholder": "Your auth token"}', ARRAY['Send an SMS', 'Make a phone call', 'Check message status', 'List phone numbers', 'Send WhatsApp message'], false),

  -- -- GitHub
  -- ('cb9a07cc-55f8-4492-9c3e-cfdebf1ea2d0', 'github', 'GitHub', 'Code hosting platform for version control and collaboration', 'devops', '/integrations/github.svg', 'https://docs.github.com/en/rest', 'openapi', 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json', NULL, NULL, 'stdio', 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Personal Access Token", "credential_placeholder": "ghp_..."}', ARRAY['Create an issue', 'Merge a pull request', 'Create a release', 'List repository commits', 'Add a collaborator'], false),

  -- -- PagerDuty
  -- ('5cf457e4-0e4d-40f8-8cc0-f62d8edcc6ea', 'pagerduty', 'PagerDuty', 'Incident management platform for DevOps teams', 'devops', '/integrations/pagerduty.svg', 'https://developer.pagerduty.com/api-reference', 'openapi', 'https://raw.githubusercontent.com/PagerDuty/api-schema/main/reference/REST/openapiv3.json', NULL, NULL, 'stdio', 'bearer', '{"header": "Authorization", "prefix": "Token token=", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "Your PagerDuty API key"}', ARRAY['Trigger an incident', 'Acknowledge an alert', 'Escalate to on-call', 'List active incidents', 'Resolve an incident'], false),

  -- -- Shopify
  -- ('29b57ec2-6023-486d-86af-3818e086e66e', 'shopify', 'Shopify', 'E-commerce platform for online stores', 'ecommerce', '/integrations/shopify.svg', 'https://shopify.dev/docs/api/admin-rest', 'openapi', NULL, NULL, NULL, 'stdio', 'header', '{"header": "X-Shopify-Access-Token", "credential_field": "access_token", "credential_label": "Admin API Token", "credential_placeholder": "shpat_..."}', ARRAY['List orders', 'Create refund', 'Update inventory', 'Cancel order', 'Add product'], false),

  -- -- Vercel
  -- ('21df7ee4-812a-423c-9ea9-6d1a8b534e44', 'vercel', 'Vercel', 'Frontend cloud platform for deployments', 'devops', '/integrations/vercel.svg', 'https://vercel.com/docs/rest-api', 'openapi', NULL, NULL, NULL, 'stdio', 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Token", "credential_placeholder": "Your Vercel token"}', ARRAY['List deployments', 'Trigger redeploy', 'Check deployment status', 'Update env vars', 'Rollback deployment'], false)

ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  logo_url = EXCLUDED.logo_url,
  docs_url = EXCLUDED.docs_url,
  source_type = EXCLUDED.source_type,
  spec_url = EXCLUDED.spec_url,
  mcp_package = EXCLUDED.mcp_package,
  mcp_server_url = EXCLUDED.mcp_server_url,
  mcp_transport = EXCLUDED.mcp_transport,
  auth_type = EXCLUDED.auth_type,
  auth_config = EXCLUDED.auth_config,
  use_cases = EXCLUDED.use_cases,
  is_featured = EXCLUDED.is_featured,
  updated_at = now();

-- Show count
DO $$
BEGIN
  RAISE NOTICE 'Seeded % templates (5 HTTP MCP + 5 OpenAPI)', (SELECT count(*) FROM source_templates);
END $$;
