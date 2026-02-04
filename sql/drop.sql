-- ============================================================================
-- ActionChat — Drop all tables and functions
-- Run this to reset the schema completely before running 001.sql
-- ============================================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS
  user_onboarding,
  api_keys,
  embed_configs,
  messages,
  chats,
  routines,
  member_agent_access,
  agent_sources,
  agents,
  tools,
  template_tools,
  user_api_credentials,
  api_sources,
  source_templates,
  org_invites,
  org_members,
  org
CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS set_updated_at CASCADE;
DROP FUNCTION IF EXISTS get_user_org_ids CASCADE;
DROP FUNCTION IF EXISTS get_user_admin_org_ids CASCADE;
DROP FUNCTION IF EXISTS get_user_owner_org_ids CASCADE;
DROP FUNCTION IF EXISTS get_user_agent_ids CASCADE;
DROP FUNCTION IF EXISTS ensure_current_user_org CASCADE;
DROP FUNCTION IF EXISTS my_organizations CASCADE;
DROP FUNCTION IF EXISTS get_my_org_id CASCADE;
DROP FUNCTION IF EXISTS check_domain_auto_join CASCADE;
DROP FUNCTION IF EXISTS get_agent_tools CASCADE;
DROP FUNCTION IF EXISTS get_user_accessible_agents CASCADE;
DROP FUNCTION IF EXISTS search_tools_semantic CASCADE;
DROP FUNCTION IF EXISTS search_template_tools_semantic CASCADE;
DROP FUNCTION IF EXISTS search_tools_semantic_1536 CASCADE;
DROP FUNCTION IF EXISTS search_tools_semantic_768 CASCADE;
DROP FUNCTION IF EXISTS search_template_tools_semantic_1536 CASCADE;
DROP FUNCTION IF EXISTS search_template_tools_semantic_768 CASCADE;
DROP FUNCTION IF EXISTS get_template_tools CASCADE;
