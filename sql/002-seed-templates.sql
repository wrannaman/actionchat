-- ============================================================================
-- ActionChat — Seed Integration Templates
--
-- Run this after 001.sql to populate the source_templates table.
-- Uses ON CONFLICT to allow re-running without duplicates.
-- ============================================================================

INSERT INTO source_templates (id, slug, name, description, category, logo_url, docs_url, source_type, spec_url, mcp_package, auth_type, auth_config, use_cases, is_featured)
VALUES
  -- Stripe
  ('2e059b2b-9cef-4440-bf7f-be6d6eeb9160', 'stripe', 'Stripe', 'Payment processing platform for internet businesses', 'payments', '/integrations/stripe.svg', 'https://stripe.com/docs/api', 'openapi', 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Secret Key", "credential_placeholder": "sk_live_..."}', ARRAY['Refund a customer', 'Create a charge', 'Cancel subscription', 'List recent payments', 'Create invoice'], true),

  -- Twilio
  ('204bee05-541e-4161-a9b5-4fd36d1b843c', 'twilio', 'Twilio', 'Cloud communications platform for SMS, voice, and video', 'communication', '/integrations/twilio.svg', 'https://www.twilio.com/docs/api', 'openapi', 'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json', NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "Account SID", "username_placeholder": "AC...", "password_label": "Auth Token", "password_placeholder": "Your auth token"}', ARRAY['Send an SMS', 'Make a phone call', 'Check message status', 'List phone numbers', 'Send WhatsApp message'], true),

  -- GitHub
  ('cb9a07cc-55f8-4492-9c3e-cfdebf1ea2d0', 'github', 'GitHub', 'Code hosting platform for version control and collaboration', 'devops', '/integrations/github.svg', 'https://docs.github.com/en/rest', 'openapi', 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Personal Access Token", "credential_placeholder": "ghp_..."}', ARRAY['Create an issue', 'Merge a pull request', 'Create a release', 'List repository commits', 'Add a collaborator'], true),

  -- Slack
  ('e3249c17-f7ff-42af-bd5d-433a86c6ee5a', 'slack', 'Slack', 'Business communication platform for teams', 'communication', '/integrations/slack.svg', 'https://api.slack.com/methods', 'openapi', 'https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Bot Token", "credential_placeholder": "xoxb-..."}', ARRAY['Post a message', 'Create a channel', 'Invite user to channel', 'Upload a file', 'Set channel topic'], true),

  -- SendGrid
  ('730ce519-a862-4b2b-86f9-96a41817e77c', 'sendgrid', 'SendGrid', 'Email delivery platform for transactional and marketing emails', 'communication', '/integrations/sendgrid.svg', 'https://docs.sendgrid.com/api-reference', 'openapi', 'https://raw.githubusercontent.com/twilio/sendgrid-oai/main/oai.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "SG...."}', ARRAY['Send an email', 'Manage contacts', 'Check bounce list', 'Create email template', 'View email statistics'], false),

  -- PagerDuty
  ('5cf457e4-0e4d-40f8-8cc0-f62d8edcc6ea', 'pagerduty', 'PagerDuty', 'Incident management platform for DevOps teams', 'devops', '/integrations/pagerduty.svg', 'https://developer.pagerduty.com/api-reference', 'openapi', 'https://raw.githubusercontent.com/PagerDuty/api-schema/main/reference/REST/openapiv3.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Token token=", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "Your PagerDuty API key"}', ARRAY['Trigger an incident', 'Acknowledge an alert', 'Escalate to on-call', 'List active incidents', 'Resolve an incident'], true),

  -- Datadog
  ('9ff9e8c7-1f68-4549-85c6-44fd0e279778', 'datadog', 'Datadog', 'Monitoring and analytics platform for cloud-scale applications', 'devops', '/integrations/datadog.svg', 'https://docs.datadoghq.com/api', 'openapi', 'https://raw.githubusercontent.com/DataDog/datadog-api-client-python/master/.generator/schemas/v1/openapi.yaml', NULL, 'header', '{"headers": {"DD-API-KEY": "api_key", "DD-APPLICATION-KEY": "app_key"}, "credential_fields": ["api_key", "app_key"], "api_key_label": "API Key", "app_key_label": "Application Key"}', ARRAY['Create a monitor', 'Mute an alert', 'Query metrics', 'List dashboards', 'Submit a log'], false),

  -- Linear
  ('f3b89547-fdaa-4cd7-8730-58ffe454c4e5', 'linear', 'Linear', 'Issue tracking and project management for software teams', 'project_management', '/integrations/linear.svg', 'https://developers.linear.app/docs/graphql/working-with-the-graphql-api', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Key", "credential_placeholder": "lin_api_..."}', ARRAY['Create an issue', 'Update ticket status', 'Assign to team member', 'Add a comment', 'Create a project'], true),

  -- Jira
  ('242c7d2f-590e-4da5-8324-0f1e44178921', 'jira', 'Jira', 'Issue and project tracking for agile teams', 'project_management', '/integrations/jira.svg', 'https://developer.atlassian.com/cloud/jira/platform/rest/v3', 'openapi', 'https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json', NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "Email", "username_placeholder": "your@email.com", "password_label": "API Token", "password_placeholder": "Your Jira API token"}', ARRAY['Create a ticket', 'Transition issue status', 'Add a comment', 'Assign to user', 'Update priority'], false),

  -- Cloudflare
  ('67f9d620-694d-4d5e-8f28-95b1942925fe', 'cloudflare', 'Cloudflare', 'Web performance and security services', 'infrastructure', '/integrations/cloudflare.svg', 'https://developers.cloudflare.com/api', 'openapi', 'https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Token", "credential_placeholder": "Your Cloudflare API token"}', ARRAY['Purge cache', 'Update DNS record', 'Create a Worker', 'List zones', 'Enable WAF rule'], false),

  -- HubSpot
  ('62334fa1-77cd-437b-956a-15886386c5a2', 'hubspot', 'HubSpot', 'CRM and marketing automation platform', 'crm', '/integrations/hubspot.svg', 'https://developers.hubspot.com/docs/api/overview', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Private App Token", "credential_placeholder": "pat-..."}', ARRAY['Create a contact', 'Update a deal', 'Send an email', 'Log an activity', 'Create a company'], false),

  -- Intercom
  ('1c26d33f-bf9a-4049-8534-64d89261bbeb', 'intercom', 'Intercom', 'Customer messaging platform for sales and support', 'support', '/integrations/intercom.svg', 'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/', 'openapi', 'https://raw.githubusercontent.com/intercom/Intercom-OpenAPI/main/descriptions/2.11/api.intercom.io.yaml', NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Access Token", "credential_placeholder": "dG9rOi..."}', ARRAY['Create a conversation', 'Send a message', 'Update user attributes', 'Add a tag', 'Close conversation'], false),

  -- Zendesk
  ('395a460e-cf1b-4eab-83e4-792249b6c5c7', 'zendesk', 'Zendesk', 'Customer service and engagement platform', 'support', '/integrations/zendesk.svg', 'https://developer.zendesk.com/api-reference', 'openapi', NULL, NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "Email/token", "username_placeholder": "email@domain.com/token", "password_label": "API Token", "password_placeholder": "Your Zendesk API token"}', ARRAY['Create a ticket', 'Update ticket status', 'Add internal note', 'Assign to agent', 'Close ticket'], false),

  -- Freshdesk
  ('2669f6d9-eee7-4bf0-9ba8-ea849031c279', 'freshdesk', 'Freshdesk', 'Customer support software for growing businesses', 'support', '/integrations/freshdesk.svg', 'https://developers.freshdesk.com/api/', 'openapi', 'https://raw.githubusercontent.com/ccl-consulting/freshdesk-openapi/master/swagger.json', NULL, 'basic', '{"credential_fields": ["username", "password"], "username_label": "API Key", "username_placeholder": "Your API key", "password_label": "Password", "password_placeholder": "x (use ''x'' as password)"}', ARRAY['Create a ticket', 'Reply to ticket', 'Resolve ticket', 'Add note', 'Assign agent'], false),

  -- Notion (MCP)
  ('d48c08cb-3e87-4b03-9608-7a5799285c20', 'notion', 'Notion', 'All-in-one workspace for notes, docs, and databases', 'productivity', '/integrations/notion.svg', 'https://developers.notion.com/docs', 'mcp', NULL, '@notionhq/notion-mcp-server', 'api_key', '{"env_var": "NOTION_API_KEY", "credential_field": "api_key", "credential_label": "Integration Token", "credential_placeholder": "secret_..."}', ARRAY['Create a page', 'Update a database', 'Query records', 'Add a comment', 'Search content'], true),

  -- Airtable
  ('d7802188-4591-4089-a223-7bf4238a4ac6', 'airtable', 'Airtable', 'Spreadsheet-database hybrid for flexible data management', 'productivity', '/integrations/airtable.svg', 'https://airtable.com/developers/web/api', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Personal Access Token", "credential_placeholder": "pat..."}', ARRAY['Create a record', 'Update record', 'Query a base', 'Delete record', 'List tables'], false),

  -- Supabase
  ('7fd72b14-09b4-4ea9-ba2d-4662cc543892', 'supabase', 'Supabase', 'Open source Firebase alternative with Postgres database', 'database', '/integrations/supabase.svg', 'https://supabase.com/docs/reference', 'openapi', NULL, NULL, 'bearer', '{"header": "apikey", "credential_field": "api_key", "credential_label": "Service Role Key", "credential_placeholder": "eyJ..."}', ARRAY['Insert row', 'Query data', 'Update record', 'Call RPC function', 'Manage auth users'], false),

  -- PostgreSQL (MCP)
  ('5c5f6567-8e80-4d7f-b3ed-53ddabc23a16', 'postgres', 'PostgreSQL', 'Powerful open source relational database', 'database', '/integrations/postgres.svg', 'https://www.postgresql.org/docs/', 'mcp', NULL, '@modelcontextprotocol/server-postgres', 'none', '{"env_var": "POSTGRES_URL", "credential_field": "connection_string", "credential_label": "Connection String", "credential_placeholder": "postgresql://user:pass@host:5432/db"}', ARRAY['Query tables', 'Inspect schema', 'Run SQL', 'List databases', 'Check indexes'], false),

  -- MongoDB (MCP)
  ('b9723603-bf8d-4213-b60e-c8e49b377f25', 'mongodb', 'MongoDB', 'Document database for modern applications', 'database', '/integrations/mongodb.svg', 'https://www.mongodb.com/docs/', 'mcp', NULL, '@modelcontextprotocol/server-mongodb', 'none', '{"env_var": "MONGODB_URI", "credential_field": "connection_string", "credential_label": "Connection String", "credential_placeholder": "mongodb+srv://user:pass@cluster.mongodb.net/db"}', ARRAY['Query collection', 'Insert document', 'Update documents', 'Aggregate data', 'List collections'], false),

  -- Okta
  ('de72f490-2b50-4809-b137-41a384ca1ad5', 'okta', 'Okta', 'Identity and access management platform', 'auth', '/integrations/okta.svg', 'https://developer.okta.com/docs/reference/api/', 'openapi', 'https://raw.githubusercontent.com/okta/okta-management-openapi-spec/master/dist/spec.yaml', NULL, 'api_key', '{"header": "Authorization", "prefix": "SSWS", "credential_field": "api_key", "credential_label": "API Token", "credential_placeholder": "Your Okta API token"}', ARRAY['Create a user', 'Reset password', 'Assign app', 'Deactivate user', 'Reset MFA'], false),

  -- Auth0
  ('eaba6056-76e4-43d6-a198-e910a42be062', 'auth0', 'Auth0', 'Authentication and authorization platform', 'auth', '/integrations/auth0.svg', 'https://auth0.com/docs/api/management/v2', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "Management API Token", "credential_placeholder": "eyJ..."}', ARRAY['Create a user', 'Update user roles', 'Reset MFA', 'Block user', 'Delete user'], false),

  -- Filesystem (MCP)
  ('63d2f63a-9727-41d3-aaec-a9cc624e0bf0', 'filesystem', 'Filesystem', 'Local file system access for reading and writing files', 'system', '/integrations/filesystem.svg', 'https://modelcontextprotocol.io/docs/servers/filesystem', 'mcp', NULL, '@modelcontextprotocol/server-filesystem', 'none', '{"env_var": "ALLOWED_DIRECTORIES", "credential_field": "allowed_directories", "credential_label": "Allowed Directories", "credential_placeholder": "/path/to/dir1,/path/to/dir2"}', ARRAY['List files', 'Read file contents', 'Write to file', 'Search files', 'Move files'], false),

  -- Shopify
  ('29b57ec2-6023-486d-86af-3818e086e66e', 'shopify', 'Shopify', 'E-commerce platform for online stores', 'ecommerce', '/integrations/shopify.svg', 'https://shopify.dev/docs/api/admin-rest', 'openapi', NULL, NULL, 'header', '{"header": "X-Shopify-Access-Token", "credential_field": "access_token", "credential_label": "Admin API Token", "credential_placeholder": "shpat_..."}', ARRAY['List orders', 'Create refund', 'Update inventory', 'Cancel order', 'Add product'], false),

  -- Vercel
  ('21df7ee4-812a-423c-9ea9-6d1a8b534e44', 'vercel', 'Vercel', 'Frontend cloud platform for deployments', 'devops', '/integrations/vercel.svg', 'https://vercel.com/docs/rest-api', 'openapi', NULL, NULL, 'bearer', '{"header": "Authorization", "prefix": "Bearer", "credential_field": "token", "credential_label": "API Token", "credential_placeholder": "Your Vercel token"}', ARRAY['List deployments', 'Trigger redeploy', 'Check deployment status', 'Update env vars', 'Rollback deployment'], false)

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
