-- actionchat.io — Drop all tables and functions
-- Run this to reset the schema completely

DROP TABLE IF EXISTS
  api_keys,
  embed_configs,
  action_log,
  messages,
  chats,
  member_agent_access,
  agent_sources,
  agents,
  tools,
  api_sources,
  org_invites,
  org_members,
  org
CASCADE;

DROP FUNCTION IF EXISTS set_updated_at CASCADE;
DROP FUNCTION IF EXISTS enforce_action_status CASCADE;
DROP FUNCTION IF EXISTS ensure_current_user_org CASCADE;
DROP FUNCTION IF EXISTS my_organizations CASCADE;
DROP FUNCTION IF EXISTS get_my_org_id CASCADE;
DROP FUNCTION IF EXISTS check_domain_auto_join CASCADE;
DROP FUNCTION IF EXISTS get_agent_tools CASCADE;
DROP FUNCTION IF EXISTS get_user_accessible_agents CASCADE;
DROP FUNCTION IF EXISTS get_chat_action_summary CASCADE;
