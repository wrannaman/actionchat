-- ============================================================================
-- ActionChat — Seed Integration Templates
--
-- Run this after 001.sql to populate the source_templates table.
-- Uses ON CONFLICT to allow re-running without duplicates.
-- ============================================================================

INSERT INTO source_templates (id, slug, name, description, category, logo_url, docs_url, source_type, spec_url, mcp_package, auth_type, auth_config, use_cases, is_featured)
VALUES
  -- Stripe
  ('00000000-0000-4000-a000-000000000001', 'stripe', 'Stripe', 'Payment processing platform for internet businesses', 'payments', '/integrations/stripe.svg', 'https://stripe.com/docs/api', 'openapi', 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Secret Key", "credential_placeholder": "sk_live_..."}', ARRAY['Refund a customer', 'Create a charge', 'Cancel subscription', 'List recent payments', 'Create invoice'], true),

  -- Twilio
  ('00000000-0000-4000-a000-000000000002', 'twilio', 'Twilio', 'Cloud communications platform for SMS, voice, and video', 'communication', '/integrations/twilio.svg', 'https://www.twilio.com/docs/api', 'openapi', 'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json', NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "Account SID", "username_placeholder": "AC...", "password_label": "Auth Token", "password_placeholder": "Your auth token"}', ARRAY['Send an SMS', 'Make a phone call', 'Check message status', 'List phone numbers', 'Send WhatsApp message'], true),

  -- GitHub
  ('00000000-0000-4000-a000-000000000003', 'github', 'GitHub', 'Code hosting platform for version control and collaboration', 'devops', '/integrations/github.svg', 'https://docs.github.com/en/rest', 'openapi', 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Personal Access Token", "credential_placeholder": "ghp_..."}', ARRAY['Create an issue', 'Merge a pull request', 'Create a release', 'List repository commits', 'Add a collaborator'], true),

  -- Slack
  ('00000000-0000-4000-a000-000000000004', 'slack', 'Slack', 'Business communication platform for teams', 'communication', '/integrations/slack.svg', 'https://api.slack.com/methods', 'openapi', 'https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Bot Token", "credential_placeholder": "xoxb-..."}', ARRAY['Post a message', 'Create a channel', 'Invite user to channel', 'Upload a file', 'Set channel topic'], true),

  -- SendGrid
  ('00000000-0000-4000-a000-000000000005', 'sendgrid', 'SendGrid', 'Email delivery platform for transactional and marketing emails', 'communication', '/integrations/sendgrid.svg', 'https://docs.sendgrid.com/api-reference', 'openapi', 'https://raw.githubusercontent.com/twilio/sendgrid-oai/main/oai.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "SG...."}', ARRAY['Send an email', 'Manage contacts', 'Check bounce list', 'Create email template', 'View email statistics'], false),

  -- PagerDuty
  ('00000000-0000-4000-a000-000000000006', 'pagerduty', 'PagerDuty', 'Incident management platform for DevOps teams', 'devops', '/integrations/pagerduty.svg', 'https://developer.pagerduty.com/api-reference', 'openapi', 'https://raw.githubusercontent.com/PagerDuty/api-schema/main/reference/REST/openapiv3.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Token token=", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "Your PagerDuty API key"}', ARRAY['Trigger an incident', 'Acknowledge an alert', 'Escalate to on-call', 'List active incidents', 'Resolve an incident'], true),

  -- Datadog
  ('00000000-0000-4000-a000-000000000007', 'datadog', 'Datadog', 'Monitoring and analytics platform for cloud-scale applications', 'devops', '/integrations/datadog.svg', 'https://docs.datadoghq.com/api', 'openapi', 'https://raw.githubusercontent.com/DataDog/datadog-api-client-python/master/.generator/schemas/v1/openapi.yaml', NULL, 'header', '{"headers": {"DD-API-KEY": "api_key", "DD-APPLICATION-KEY": "app_key"}, "credential_fields": ["api_key", "app_key"], "api_key_label": "API Key", "app_key_label": "Application Key"}', ARRAY['Create a monitor', 'Mute an alert', 'Query metrics', 'List dashboards', 'Submit a log'], false),

  -- Linear
  ('00000000-0000-4000-a000-000000000008', 'linear', 'Linear', 'Issue tracking and project management for software teams', 'project_management', '/integrations/linear.svg', 'https://developers.linear.app/docs/graphql/working-with-the-graphql-api', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "lin_api_..."}', ARRAY['Create an issue', 'Update ticket status', 'Assign to team member', 'Add a comment', 'Create a project'], true),

  -- Jira
  ('00000000-0000-4000-a000-000000000009', 'jira', 'Jira', 'Issue and project tracking for agile teams', 'project_management', '/integrations/jira.svg', 'https://developer.atlassian.com/cloud/jira/platform/rest/v3', 'openapi', 'https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json', NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "Email", "username_placeholder": "your@email.com", "password_label": "API Token", "password_placeholder": "Your Jira API token"}', ARRAY['Create a ticket', 'Transition issue status', 'Add a comment', 'Assign to user', 'Update priority'], false),

  -- Cloudflare
  ('00000000-0000-4000-a000-00000000000a', 'cloudflare', 'Cloudflare', 'Web performance and security services', 'infrastructure', '/integrations/cloudflare.svg', 'https://developers.cloudflare.com/api', 'openapi', 'https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Token", "credential_placeholder": "Your Cloudflare API token"}', ARRAY['Purge cache', 'Update DNS record', 'Create a Worker', 'List zones', 'Enable WAF rule'], false),

  -- HubSpot
  ('00000000-0000-4000-a000-00000000000b', 'hubspot', 'HubSpot', 'CRM and marketing automation platform', 'crm', '/integrations/hubspot.svg', 'https://developers.hubspot.com/docs/api/overview', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Private App Token", "credential_placeholder": "pat-..."}', ARRAY['Create a contact', 'Update a deal', 'Send an email', 'Log an activity', 'Create a company'], false),

  -- Intercom
  ('00000000-0000-4000-a000-00000000000c', 'intercom', 'Intercom', 'Customer messaging platform for sales and support', 'support', '/integrations/intercom.svg', 'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/', 'openapi', 'https://raw.githubusercontent.com/intercom/Intercom-OpenAPI/main/descriptions/2.11/api.intercom.io.yaml', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Access Token", "credential_placeholder": "dG9rOi..."}', ARRAY['Create a conversation', 'Send a message', 'Update user attributes', 'Add a tag', 'Close conversation'], false),

  -- Zendesk
  ('00000000-0000-4000-a000-00000000000d', 'zendesk', 'Zendesk', 'Customer service and engagement platform', 'support', '/integrations/zendesk.svg', 'https://developer.zendesk.com/api-reference', 'openapi', NULL, NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "Email/token", "username_placeholder": "email@domain.com/token", "password_label": "API Token", "password_placeholder": "Your Zendesk API token"}', ARRAY['Create a ticket', 'Update ticket status', 'Add internal note', 'Assign to agent', 'Close ticket'], false),

  -- Freshdesk
  ('00000000-0000-4000-a000-00000000000e', 'freshdesk', 'Freshdesk', 'Customer support software for growing businesses', 'support', '/integrations/freshdesk.svg', 'https://developers.freshdesk.com/api/', 'openapi', 'https://raw.githubusercontent.com/ccl-consulting/freshdesk-openapi/master/swagger.json', NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "API Key", "username_placeholder": "Your API key", "password_label": "Password", "password_placeholder": "x (use ''x'' as password)"}', ARRAY['Create a ticket', 'Reply to ticket', 'Resolve ticket', 'Add note', 'Assign agent'], false),

  -- Notion (MCP)
  ('00000000-0000-4000-a000-00000000000f', 'notion', 'Notion', 'All-in-one workspace for notes, docs, and databases', 'productivity', '/integrations/notion.svg', 'https://developers.notion.com/docs', 'mcp', NULL, '@notionhq/notion-mcp-server', 'api_key', '{"env_var": "NOTION_API_KEY", "credential_field": "api_key", "credential_label": "Integration Token", "credential_placeholder": "secret_..."}', ARRAY['Create a page', 'Update a database', 'Query records', 'Add a comment', 'Search content'], true),

  -- Airtable
  ('00000000-0000-4000-a000-000000000010', 'airtable', 'Airtable', 'Spreadsheet-database hybrid for flexible data management', 'productivity', '/integrations/airtable.svg', 'https://airtable.com/developers/web/api', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Personal Access Token", "credential_placeholder": "pat..."}', ARRAY['Create a record', 'Update record', 'Query a base', 'Delete record', 'List tables'], false),

  -- Supabase
  ('00000000-0000-4000-a000-000000000011', 'supabase', 'Supabase', 'Open source Firebase alternative with Postgres database', 'database', '/integrations/supabase.svg', 'https://supabase.com/docs/reference', 'openapi', NULL, NULL, 'bearer', '{"header": "apikey", "credential_field": "api_key", "credential_label": "Service Role Key", "credential_placeholder": "eyJ..."}', ARRAY['Insert row', 'Query data', 'Update record', 'Call RPC function', 'Manage auth users'], false),

  -- PostgreSQL (MCP)
  ('00000000-0000-4000-a000-000000000012', 'postgres', 'PostgreSQL', 'Powerful open source relational database', 'database', '/integrations/postgres.svg', 'https://www.postgresql.org/docs/', 'mcp', NULL, '@modelcontextprotocol/server-postgres', 'none', '{"env_var": "POSTGRES_URL", "credential_field": "connection_string", "credential_label": "Connection String", "credential_placeholder": "postgresql://user:pass@host:5432/db"}', ARRAY['Query tables', 'Inspect schema', 'Run SQL', 'List databases', 'Check indexes'], false),

  -- MongoDB (MCP)
  ('00000000-0000-4000-a000-000000000013', 'mongodb', 'MongoDB', 'Document database for modern applications', 'database', '/integrations/mongodb.svg', 'https://www.mongodb.com/docs/', 'mcp', NULL, '@modelcontextprotocol/server-mongodb', 'none', '{"env_var": "MONGODB_URI", "credential_field": "connection_string", "credential_label": "Connection String", "credential_placeholder": "mongodb+srv://user:pass@cluster.mongodb.net/db"}', ARRAY['Query collection', 'Insert document', 'Update documents', 'Aggregate data', 'List collections'], false),

  -- Okta
  ('00000000-0000-4000-a000-000000000014', 'okta', 'Okta', 'Identity and access management platform', 'auth', '/integrations/okta.svg', 'https://developer.okta.com/docs/reference/api/', 'openapi', 'https://raw.githubusercontent.com/okta/okta-management-openapi-spec/master/dist/spec.yaml', NULL, 'api_key', '{"header": "Authorization", "prefix": "SSWS", "credential_field": "api_key", "credential_label": "API Token", "credential_placeholder": "Your Okta API token"}', ARRAY['Create a user', 'Reset password', 'Assign app', 'Deactivate user', 'Reset MFA'], false),

  -- Auth0
  ('00000000-0000-4000-a000-000000000015', 'auth0', 'Auth0', 'Authentication and authorization platform', 'auth', '/integrations/auth0.svg', 'https://auth0.com/docs/api/management/v2', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Management API Token", "credential_placeholder": "eyJ..."}', ARRAY['Create a user', 'Update user roles', 'Reset MFA', 'Block user', 'Delete user'], false),

  -- Filesystem (MCP)
  ('00000000-0000-4000-a000-000000000016', 'filesystem', 'Filesystem', 'Local file system access for reading and writing files', 'system', '/integrations/filesystem.svg', 'https://modelcontextprotocol.io/docs/servers/filesystem', 'mcp', NULL, '@modelcontextprotocol/server-filesystem', 'none', '{"env_var": "ALLOWED_DIRECTORIES", "credential_field": "allowed_directories", "credential_label": "Allowed Directories", "credential_placeholder": "/path/to/dir1,/path/to/dir2"}', ARRAY['List files', 'Read file contents', 'Write to file', 'Search files', 'Move files'], false),

  -- Shopify
  ('00000000-0000-4000-a000-000000000017', 'shopify', 'Shopify', 'E-commerce platform for online stores', 'ecommerce', '/integrations/shopify.svg', 'https://shopify.dev/docs/api/admin-rest', 'openapi', NULL, NULL, 'header', '{"header": "X-Shopify-Access-Token", "credential_field": "access_token", "credential_label": "Admin API Token", "credential_placeholder": "shpat_..."}', ARRAY['List orders', 'Create refund', 'Update inventory', 'Cancel order', 'Add product'], false),

  -- Vercel
  ('00000000-0000-4000-a000-000000000018', 'vercel', 'Vercel', 'Frontend cloud platform for deployments', 'devops', '/integrations/vercel.svg', 'https://vercel.com/docs/rest-api', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Token", "credential_placeholder": "Your Vercel token"}', ARRAY['List deployments', 'Trigger redeploy', 'Check deployment status', 'Update env vars', 'Rollback deployment'], false)

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
  auth_type = EXCLUDED.auth_type,
  auth_config = EXCLUDED.auth_config,
  use_cases = EXCLUDED.use_cases,
  is_featured = EXCLUDED.is_featured,
  updated_at = now();

-- Show count
DO $$
BEGIN
  RAISE NOTICE 'Seeded % templates', (SELECT count(*) FROM source_templates);
END $$;
