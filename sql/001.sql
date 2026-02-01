-- ============================================================================
-- ActionChat — Database Schema
-- "The Anti-UI for Internal Operations"
--
-- 13 tables, RLS on everything, 7 helper functions, 1 status machine trigger.
-- Run sql/drop.sql first if re-creating.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================================
-- 1. ORG — multi-tenant root
-- ============================================================================

CREATE TABLE org (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  allowed_domain TEXT,                    -- email domain for auto-join (e.g. "acme.com")
  is_onboarded BOOLEAN NOT NULL DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}',   -- LLM API keys, plan config, feature flags
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_org BEFORE UPDATE ON org FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE org IS 'Tenant root. settings JSONB holds LLM keys (owner-only UPDATE RLS).';

-- ============================================================================
-- 2. ORG_MEMBERS — membership + roles
-- ============================================================================

CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- tracks role changes
  UNIQUE(org_id, user_id)
);
CREATE TRIGGER trg_org_members BEFORE UPDATE ON org_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_om_user ON org_members(user_id);
CREATE INDEX idx_om_org ON org_members(org_id);
COMMENT ON TABLE org_members IS 'Org membership. owner > admin > member. updated_at tracks role changes.';

-- ============================================================================
-- 3. ORG_INVITES — invite tokens + domain auto-join
-- ============================================================================

CREATE TABLE org_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invites_token ON org_invites(token);
COMMENT ON TABLE org_invites IS 'Invite links with optional expiry and max uses.';

-- ============================================================================
-- 4. SOURCE_TEMPLATES — pre-configured integrations catalog
-- ============================================================================

CREATE TABLE source_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template metadata
  slug TEXT UNIQUE NOT NULL,              -- 'stripe', 'twilio', etc.
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                          -- 'payments', 'communication', 'devops'
  logo_url TEXT,
  docs_url TEXT,

  -- Template content
  source_type TEXT NOT NULL CHECK (source_type IN ('openapi', 'mcp')),
  spec_url TEXT,                          -- for OpenAPI: URL to fetch spec
  spec_content JSONB,                     -- cached spec
  mcp_package TEXT,                       -- for stdio MCP: npm package or path
  mcp_server_url TEXT,                    -- for HTTP MCP: remote server URL
  mcp_transport TEXT DEFAULT 'stdio',     -- 'stdio' or 'http'

  -- Auth configuration
  auth_type TEXT DEFAULT 'api_key',
  auth_config JSONB DEFAULT '{}',         -- { header, prefix, env_var, etc. }

  -- Use cases (for display)
  use_cases TEXT[] DEFAULT '{}',

  -- Metadata
  is_featured BOOLEAN DEFAULT false,
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trg_source_templates BEFORE UPDATE ON source_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_templates_category ON source_templates(category);
CREATE INDEX idx_templates_featured ON source_templates(is_featured) WHERE is_featured = true;
COMMENT ON TABLE source_templates IS 'Pre-configured integration templates for one-click setup.';

-- ============================================================================
-- 5. API_SOURCES — "Scopes": OpenAPI specs, MCP servers, or manual endpoint collections
-- ============================================================================

CREATE TABLE api_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  template_id UUID REFERENCES source_templates(id),  -- if created from a template
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'openapi' CHECK (source_type IN ('openapi', 'manual', 'mcp')),
  spec_content JSONB,                     -- raw OpenAPI spec JSON
  spec_url TEXT,                          -- remote URL to fetch OpenAPI spec from
  spec_hash TEXT,                         -- SHA-256 of spec_content for change detection
  base_url TEXT,                          -- e.g. "https://api.stripe.com/v1"
  -- MCP-specific fields
  mcp_server_uri TEXT,                    -- MCP server command or URL
  mcp_transport TEXT DEFAULT 'stdio',     -- 'stdio' or 'http'
  mcp_env JSONB DEFAULT '{}',             -- environment variables for MCP server
  -- Auth configuration
  auth_type TEXT NOT NULL DEFAULT 'passthrough'
    CHECK (auth_type IN ('bearer', 'api_key', 'basic', 'passthrough', 'none', 'header')),
  auth_config JSONB NOT NULL DEFAULT '{}', -- target API credentials (stripped for non-admins in API layer)
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,             -- when spec was last re-parsed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_api_sources BEFORE UPDATE ON api_sources FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_sources_org ON api_sources(org_id);
COMMENT ON TABLE api_sources IS 'A "Scope" — one OpenAPI spec or manual endpoint collection. auth_config holds target API credentials.';

-- ============================================================================
-- 5. USER_API_CREDENTIALS — per-user auth for each API source
-- ============================================================================

CREATE TABLE user_api_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES api_sources(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Default',    -- user-defined label, e.g. "Production", "Test", "Staging"
  credentials JSONB NOT NULL DEFAULT '{}',  -- { token: "xxx" } or { api_key: "xxx" } or { username, password }
  is_active BOOLEAN NOT NULL DEFAULT true,  -- which credential to use (only one active per user+source)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_id, label)         -- prevent duplicate labels per user+source
);
CREATE TRIGGER trg_user_api_credentials BEFORE UPDATE ON user_api_credentials FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_uac_user ON user_api_credentials(user_id);
CREATE INDEX idx_uac_source ON user_api_credentials(source_id);
CREATE INDEX idx_uac_active ON user_api_credentials(user_id, source_id, is_active) WHERE is_active = true;
COMMENT ON TABLE user_api_credentials IS 'Per-user credentials for API sources. Supports multiple credentials per source with labels (e.g. Test/Prod).';

-- ============================================================================
-- 6. TOOLS — individual API endpoints parsed from spec or manually defined
-- ============================================================================

CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES api_sources(id) ON DELETE CASCADE,
  operation_id TEXT,                      -- OpenAPI operationId (stable key for re-sync)
  name TEXT NOT NULL,                     -- human-readable, e.g. "Refund Payment"
  description TEXT,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'MCP')),
  path TEXT NOT NULL,                     -- e.g. "/v1/refunds" (for MCP: tool name)
  parameters JSONB NOT NULL DEFAULT '{}', -- JSON Schema for query/path params
  request_body JSONB,                     -- JSON Schema for request body
  -- MCP-specific fields
  mcp_tool_name TEXT,                     -- MCP tool identifier
  -- Risk and confirmation
  risk_level TEXT NOT NULL DEFAULT 'safe'
    CHECK (risk_level IN ('safe', 'moderate', 'dangerous')),
  requires_confirmation BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tools BEFORE UPDATE ON tools FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_tools_source ON tools(source_id) WHERE is_active;
CREATE UNIQUE INDEX idx_tools_operation ON tools(source_id, operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX idx_tools_tags ON tools USING GIN (tags);
COMMENT ON TABLE tools IS 'Single API endpoint. Parsed from OpenAPI spec or manually defined. operation_id is the stable sync key.';

-- ============================================================================
-- 6. AGENTS — configured bot instances
-- ============================================================================

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL DEFAULT 'You are a helpful operations assistant. Be concise. Always include IDs in your responses.',
  model_provider TEXT NOT NULL DEFAULT 'openai'
    CHECK (model_provider IN ('openai', 'anthropic', 'ollama')),
  model_name TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.1 CHECK (temperature >= 0 AND temperature <= 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',   -- max_tokens, top_p, tool_choice, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_agents BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_agents_org ON agents(org_id);
COMMENT ON TABLE agents IS 'A configured bot. Assigned to sources via agent_sources. Soft-delete via is_active.';

-- ============================================================================
-- 7. AGENT_SOURCES — M:M agent <> source with permission
-- ============================================================================

CREATE TABLE agent_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES api_sources(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'read_write')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, source_id)
);
CREATE INDEX idx_as_source ON agent_sources(source_id);  -- reverse lookup: "which agents use this source?"
COMMENT ON TABLE agent_sources IS 'Links agents to sources. read = GET only, read_write = all methods.';

-- ============================================================================
-- 8. MEMBER_AGENT_ACCESS — per-agent RBAC for org members
-- ============================================================================

CREATE TABLE member_agent_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'operator' CHECK (access_level IN ('operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, agent_id)
);
CREATE INDEX idx_maa_agent ON member_agent_access(agent_id);  -- reverse lookup: "who has access to this agent?"
COMMENT ON TABLE member_agent_access IS 'Grants a member access to a specific agent. owner/admin skip this — they see all agents.';

-- ============================================================================
-- 9. ROUTINES — saved prompt templates (free text, LLM interprets)
-- ============================================================================

CREATE TABLE routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,                     -- free text template, e.g. "Refund [email] for [amount]"
  description TEXT,                         -- optional short description
  is_shared BOOLEAN NOT NULL DEFAULT false, -- visible to whole org or just creator
  use_count INTEGER NOT NULL DEFAULT 0,     -- track popularity
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_routines BEFORE UPDATE ON routines FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_routines_org ON routines(org_id);
CREATE INDEX idx_routines_user ON routines(created_by);
COMMENT ON TABLE routines IS 'Saved prompt templates. Free text, no strict schema. LLM interprets placeholders.';

-- ============================================================================
-- 10. CHATS — conversation sessions
-- ============================================================================

CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,  -- denormalized for RLS + dashboards
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  source_ids UUID[] NOT NULL DEFAULT '{}',  -- snapshot of which API sources were active
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_chats BEFORE UPDATE ON chats FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_chats_user ON chats(user_id);
CREATE INDEX idx_chats_user_recent ON chats(user_id, created_at DESC) WHERE NOT is_archived;
CREATE INDEX idx_chats_org ON chats(org_id, created_at DESC);
COMMENT ON TABLE chats IS 'Conversation session. org_id denormalized to avoid join in RLS.';

-- ============================================================================
-- 10. MESSAGES — chat messages
-- ============================================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,
  tool_calls JSONB,                       -- [{tool_id, name, arguments, result}]
  metadata JSONB NOT NULL DEFAULT '{}',   -- token counts, latency, model used
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_chat ON messages(chat_id, created_at);
COMMENT ON TABLE messages IS 'Chat messages. tool_calls JSONB links to actions executed.';

-- ============================================================================
-- 11. ACTION_LOG — THE audit trail (append-mostly, immutable)
-- ============================================================================

CREATE TABLE action_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,  -- denormalized: survives chat deletion, needed for API-key usage
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,                -- snapshot: survives tool deletion/rename
  method TEXT NOT NULL,
  url TEXT NOT NULL,                      -- full resolved URL
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN (
      'pending_confirmation', 'confirmed', 'rejected',
      'executing', 'completed', 'failed'
    )),
  requires_confirmation BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- who confirmed/rejected (may differ from user_id if admin)
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_actions_org ON action_log(org_id, created_at DESC);
CREATE INDEX idx_actions_agent ON action_log(agent_id, created_at DESC);
CREATE INDEX idx_actions_chat ON action_log(chat_id);
CREATE INDEX idx_actions_user ON action_log(user_id, created_at DESC);
CREATE INDEX idx_actions_pending ON action_log(status) WHERE status IN ('pending_confirmation', 'executing');
COMMENT ON TABLE action_log IS 'Immutable audit trail. No DELETE policy. Status transitions enforced by trigger. tool_name is a snapshot.';

-- Status machine: enforce valid transitions + auto-stamp timestamps
CREATE OR REPLACE FUNCTION enforce_action_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Terminal states: no way out
  IF OLD.status IN ('rejected', 'completed', 'failed') THEN
    RAISE EXCEPTION 'action_log: cannot transition from terminal status "%"', OLD.status;
  END IF;

  -- Valid transitions
  IF OLD.status = 'pending_confirmation' AND NEW.status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'action_log: pending_confirmation can only become confirmed or rejected, not "%"', NEW.status;
  END IF;
  IF OLD.status = 'confirmed' AND NEW.status != 'executing' THEN
    RAISE EXCEPTION 'action_log: confirmed can only become executing, not "%"', NEW.status;
  END IF;
  IF OLD.status = 'executing' AND NEW.status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'action_log: executing can only become completed or failed, not "%"', NEW.status;
  END IF;

  -- Auto-stamp timestamps on transition
  IF NEW.status = 'confirmed' THEN NEW.confirmed_at = now(); END IF;
  IF NEW.status = 'executing'  THEN NEW.executed_at  = now(); END IF;
  IF NEW.status IN ('completed', 'failed') THEN NEW.completed_at = now(); END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_action_status BEFORE UPDATE ON action_log
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enforce_action_status();

-- ============================================================================
-- 12. EMBED_CONFIGS — widget deployment
-- ============================================================================

CREATE TABLE embed_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Widget',
  embed_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  theme JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_embed_configs BEFORE UPDATE ON embed_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_embed_token ON embed_configs(embed_token);
COMMENT ON TABLE embed_configs IS 'Embeddable chat widget config. embed_token is public — security via allowed_origins + optional JWT.';

-- ============================================================================
-- 13. API_KEYS — programmatic access scoped to agents
-- ============================================================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,               -- "ac_abc12..." for display
  agent_ids UUID[],                       -- NULL = all agents in org
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_org ON api_keys(org_id);
COMMENT ON TABLE api_keys IS 'Programmatic access tokens. Scoped to specific agents or org-wide. Hash-only storage.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE org                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools                ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_agent_access  ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats                ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_configs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys             ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- RLS HELPER FUNCTIONS (SECURITY DEFINER to avoid infinite recursion)
-- These bypass RLS when checking org membership, breaking the circular reference.
-- ────────────────────────────────────────────────────────────────────────────

-- Get user's org IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(array_agg(org_id), '{}')
  FROM org_members
  WHERE user_id = auth.uid()
$$;

-- Get user's admin org IDs (owner or admin role)
CREATE OR REPLACE FUNCTION get_user_admin_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(array_agg(org_id), '{}')
  FROM org_members
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
$$;

-- Get user's owner org IDs
CREATE OR REPLACE FUNCTION get_user_owner_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(array_agg(org_id), '{}')
  FROM org_members
  WHERE user_id = auth.uid() AND role = 'owner'
$$;

-- Get agent IDs user can access (admin orgs + member_agent_access grants)
-- This bypasses RLS to avoid infinite recursion in agent policies
CREATE OR REPLACE FUNCTION get_user_agent_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT agent_id), '{}')
  FROM (
    -- Admins/owners can access all agents in their orgs
    SELECT a.id AS agent_id
    FROM agents a
    JOIN org_members om ON a.org_id = om.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    UNION
    -- Members can access agents they're granted access to
    SELECT maa.agent_id
    FROM member_agent_access maa
    JOIN org_members om ON om.id = maa.member_id
    WHERE om.user_id = auth.uid()
  ) sub
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY POLICIES
-- Using helper functions to avoid infinite recursion on org_members
-- ────────────────────────────────────────────────────────────────────────────

-- org: see yours, create freely, owners update
CREATE POLICY org_select ON org FOR SELECT USING (
  id = ANY(get_user_org_ids()));
CREATE POLICY org_insert ON org FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY org_update ON org FOR UPDATE USING (
  id = ANY(get_user_owner_org_ids()));

-- org_members: see your org's members, insert own, owner/admin update roles + delete (or self-leave)
CREATE POLICY om_select ON org_members FOR SELECT USING (
  org_id = ANY(get_user_org_ids()));
CREATE POLICY om_insert ON org_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY om_update ON org_members FOR UPDATE USING (
  org_id = ANY(get_user_admin_org_ids()));
CREATE POLICY om_delete ON org_members FOR DELETE USING (
  user_id = auth.uid()
  OR org_id = ANY(get_user_admin_org_ids()));

-- org_invites: admin manages, anyone reads active (for redemption)
CREATE POLICY invites_admin ON org_invites FOR ALL USING (
  org_id = ANY(get_user_admin_org_ids()));
CREATE POLICY invites_public ON org_invites FOR SELECT USING (is_active = true);

-- source_templates: public read (catalog), admin-only write (seeding)
CREATE POLICY templates_read ON source_templates FOR SELECT USING (true);
CREATE POLICY templates_write ON source_templates FOR ALL USING (false); -- seeded via migrations only

-- api_sources: members read, admin writes
CREATE POLICY sources_read ON api_sources FOR SELECT USING (
  org_id = ANY(get_user_org_ids()));
CREATE POLICY sources_write ON api_sources FOR ALL USING (
  org_id = ANY(get_user_admin_org_ids()));

-- user_api_credentials: users manage their own credentials only
CREATE POLICY uac_own ON user_api_credentials FOR ALL USING (user_id = auth.uid());

-- tools: members read (via source org), admin writes
CREATE POLICY tools_read ON tools FOR SELECT USING (
  source_id IN (SELECT id FROM api_sources WHERE org_id = ANY(get_user_org_ids())));
CREATE POLICY tools_write ON tools FOR ALL USING (
  source_id IN (SELECT id FROM api_sources WHERE org_id = ANY(get_user_admin_org_ids())));

-- agents: use get_user_agent_ids() to avoid infinite recursion
CREATE POLICY agents_select ON agents FOR SELECT USING (
  id = ANY(get_user_agent_ids()));
CREATE POLICY agents_write ON agents FOR ALL USING (
  org_id = ANY(get_user_admin_org_ids()));

-- agent_sources: use get_user_agent_ids() to avoid infinite recursion
CREATE POLICY as_select ON agent_sources FOR SELECT USING (
  agent_id = ANY(get_user_agent_ids()));
CREATE POLICY as_write ON agent_sources FOR ALL USING (
  agent_id = ANY(get_user_agent_ids()) AND agent_id IN (SELECT id FROM agents WHERE org_id = ANY(get_user_admin_org_ids())));

-- member_agent_access: admin manages grants; members see own
CREATE POLICY maa_admin ON member_agent_access FOR ALL USING (
  agent_id = ANY(get_user_agent_ids()) AND agent_id IN (SELECT id FROM agents WHERE org_id = ANY(get_user_admin_org_ids())));
CREATE POLICY maa_own ON member_agent_access FOR SELECT USING (
  member_id IN (SELECT id FROM org_members WHERE user_id = auth.uid()));

-- routines: users manage own; see shared ones in org
CREATE POLICY routines_own ON routines FOR ALL USING (created_by = auth.uid());
CREATE POLICY routines_shared ON routines FOR SELECT USING (
  is_shared = true AND org_id = ANY(get_user_org_ids()));

-- chats: users own theirs; admin views all (audit)
CREATE POLICY chats_own ON chats FOR ALL USING (user_id = auth.uid());
CREATE POLICY chats_audit ON chats FOR SELECT USING (
  org_id = ANY(get_user_admin_org_ids()));

-- messages: users own via chat; admin views all
CREATE POLICY messages_own ON messages FOR ALL USING (
  chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()));
CREATE POLICY messages_audit ON messages FOR SELECT USING (
  chat_id IN (SELECT id FROM chats WHERE org_id = ANY(get_user_admin_org_ids())));

-- action_log: users see/insert own; admin sees all; update ONLY pending_confirmation; NO delete
CREATE POLICY actions_own ON action_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY actions_audit ON action_log FOR SELECT USING (
  org_id = ANY(get_user_admin_org_ids()));
CREATE POLICY actions_insert ON action_log FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY actions_confirm ON action_log FOR UPDATE USING (
  status = 'pending_confirmation' AND (
    user_id = auth.uid()
    OR org_id = ANY(get_user_admin_org_ids())
  ));

-- embed_configs: members read; admin writes; anon reads active (widget bootstrap)
CREATE POLICY embed_read ON embed_configs FOR SELECT USING (
  org_id = ANY(get_user_org_ids()));
CREATE POLICY embed_write ON embed_configs FOR ALL USING (
  org_id = ANY(get_user_admin_org_ids()));
CREATE POLICY embed_anon ON embed_configs FOR SELECT USING (is_active = true);

-- api_keys: admin only
CREATE POLICY keys_admin ON api_keys FOR ALL USING (
  org_id = ANY(get_user_admin_org_ids()));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get-or-create the current user's org
CREATE OR REPLACE FUNCTION ensure_current_user_org(preferred_name TEXT DEFAULT 'My Org')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v UUID;
BEGIN
  SELECT org_id INTO v FROM org_members WHERE user_id = auth.uid() LIMIT 1;
  IF v IS NULL THEN
    INSERT INTO org (name) VALUES (preferred_name) RETURNING id INTO v;
    INSERT INTO org_members (org_id, user_id, role) VALUES (v, auth.uid(), 'owner');
  END IF;
  RETURN v;
END; $$;

-- List all orgs the user belongs to
CREATE OR REPLACE FUNCTION my_organizations()
RETURNS TABLE(org_id UUID, org_name TEXT, role TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT om.org_id, o.name, om.role
  FROM org_members om JOIN org o ON o.id = om.org_id
  WHERE om.user_id = auth.uid();
END; $$;

-- Shorthand: first org_id
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1);
END; $$;

-- Find orgs the user can auto-join by email domain
CREATE OR REPLACE FUNCTION check_domain_auto_join(user_email TEXT)
RETURNS TABLE(org_id UUID, org_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name
  FROM org o
  WHERE lower(o.allowed_domain) = lower(split_part(user_email, '@', 2))
    AND NOT EXISTS (SELECT 1 FROM org_members om WHERE om.org_id = o.id AND om.user_id = auth.uid());
END; $$;

-- All tools available to an agent (resolves agent_sources + filters active)
CREATE OR REPLACE FUNCTION get_agent_tools(agent_uuid UUID)
RETURNS TABLE(
  tool_id UUID, tool_name TEXT, description TEXT,
  method TEXT, path TEXT, parameters JSONB, request_body JSONB,
  risk_level TEXT, requires_confirmation BOOLEAN,
  source_name TEXT, base_url TEXT, permission TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.description,
         t.method, t.path, t.parameters, t.request_body,
         t.risk_level, t.requires_confirmation,
         s.name, s.base_url, ags.permission
  FROM tools t
  JOIN api_sources s ON s.id = t.source_id
  JOIN agent_sources ags ON ags.source_id = s.id
  WHERE ags.agent_id = agent_uuid AND t.is_active AND s.is_active;
END; $$;

-- All agents the current user can access (admin gets all, members get granted)
CREATE OR REPLACE FUNCTION get_user_accessible_agents()
RETURNS TABLE(agent_id UUID, agent_name TEXT, description TEXT, access_level TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.name, a.description, 'admin'::TEXT
  FROM agents a JOIN org_members om ON a.org_id = om.org_id
  WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin') AND a.is_active
  UNION
  SELECT a.id, a.name, a.description, maa.access_level
  FROM agents a
  JOIN member_agent_access maa ON maa.agent_id = a.id
  JOIN org_members om ON om.id = maa.member_id
  WHERE om.user_id = auth.uid() AND a.is_active;
END; $$;

-- Action summary for a chat (respects ownership + admin audit)
CREATE OR REPLACE FUNCTION get_chat_action_summary(chat_uuid UUID)
RETURNS TABLE(
  action_id UUID, tool_name TEXT, method TEXT, url TEXT,
  status TEXT, response_status INTEGER, duration_ms INTEGER, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT al.id, al.tool_name, al.method, al.url,
         al.status, al.response_status, al.duration_ms, al.created_at
  FROM action_log al
  WHERE al.chat_id = chat_uuid
    AND (al.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM org_members om
                 WHERE om.org_id = al.org_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin')))
  ORDER BY al.created_at;
END; $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_org_ids()                 TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_admin_org_ids()           TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_owner_org_ids()           TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_agent_ids()               TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_current_user_org(TEXT)      TO authenticated;
GRANT EXECUTE ON FUNCTION my_organizations()                 TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_org_id()                    TO authenticated;
GRANT EXECUTE ON FUNCTION check_domain_auto_join(TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_tools(UUID)              TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_accessible_agents()       TO authenticated;
GRANT EXECUTE ON FUNCTION get_chat_action_summary(UUID)      TO authenticated;

GRANT ALL ON org, org_members, org_invites                   TO authenticated;
GRANT SELECT ON source_templates                             TO authenticated;
GRANT SELECT ON source_templates                             TO anon;
GRANT ALL ON api_sources, tools, agents, agent_sources       TO authenticated;
GRANT ALL ON member_agent_access, chats, messages            TO authenticated;
GRANT ALL ON action_log, embed_configs, api_keys             TO authenticated;

GRANT SELECT ON embed_configs, org_invites                   TO anon;
