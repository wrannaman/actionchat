-- ============================================================================
-- Migration: Dual Embedding Columns
-- Supports both OpenAI (1536) and Gemini/Ollama (768) embeddings
-- ============================================================================

-- 1. Add 768-dimension columns to both tables
ALTER TABLE tools ADD COLUMN IF NOT EXISTS embedding_768 extensions.vector(768);
ALTER TABLE template_tools ADD COLUMN IF NOT EXISTS embedding_768 extensions.vector(768);

-- 2. Rename existing 1536 columns for clarity (if not already renamed)
-- Note: This is safe to run multiple times due to IF EXISTS checks
DO $$
BEGIN
  -- Rename tools.embedding -> tools.embedding_1536
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'tools' AND column_name = 'embedding') THEN
    ALTER TABLE tools RENAME COLUMN embedding TO embedding_1536;
  END IF;

  -- Rename template_tools.embedding -> template_tools.embedding_1536
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'template_tools' AND column_name = 'embedding') THEN
    ALTER TABLE template_tools RENAME COLUMN embedding TO embedding_1536;
  END IF;
END $$;

-- 3. Create indexes for new 768-dimension columns
CREATE INDEX IF NOT EXISTS idx_tools_embedding_768
  ON tools USING hnsw (embedding_768 extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_template_tools_embedding_768
  ON template_tools USING hnsw (embedding_768 extensions.vector_cosine_ops);

-- 4. Rename old indexes for clarity (drop and recreate if needed)
DROP INDEX IF EXISTS idx_tools_embedding;
DROP INDEX IF EXISTS idx_template_tools_embedding;
CREATE INDEX IF NOT EXISTS idx_tools_embedding_1536
  ON tools USING hnsw (embedding_1536 extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_template_tools_embedding_1536
  ON template_tools USING hnsw (embedding_1536 extensions.vector_cosine_ops);

-- 5. Create search functions for 1536 dimensions (OpenAI)
CREATE OR REPLACE FUNCTION search_tools_semantic_1536(
  p_source_ids UUID[],
  p_embedding extensions.vector(1536),
  p_limit INT DEFAULT 64
)
RETURNS TABLE (tool_id UUID, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT t.id, 1 - (t.embedding_1536 <=> p_embedding) AS similarity
  FROM tools t
  WHERE t.source_id = ANY(p_source_ids)
    AND t.is_active = true
    AND t.embedding_1536 IS NOT NULL
  ORDER BY t.embedding_1536 <=> p_embedding
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION search_template_tools_semantic_1536(
  p_template_ids UUID[],
  p_embedding extensions.vector(1536),
  p_limit INT DEFAULT 64
)
RETURNS TABLE (tool_id UUID, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT t.id, 1 - (t.embedding_1536 <=> p_embedding) AS similarity
  FROM template_tools t
  WHERE t.template_id = ANY(p_template_ids)
    AND t.is_active = true
    AND t.embedding_1536 IS NOT NULL
  ORDER BY t.embedding_1536 <=> p_embedding
  LIMIT p_limit;
$$;

-- 6. Create search functions for 768 dimensions (Gemini/Ollama)
CREATE OR REPLACE FUNCTION search_tools_semantic_768(
  p_source_ids UUID[],
  p_embedding extensions.vector(768),
  p_limit INT DEFAULT 64
)
RETURNS TABLE (tool_id UUID, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT t.id, 1 - (t.embedding_768 <=> p_embedding) AS similarity
  FROM tools t
  WHERE t.source_id = ANY(p_source_ids)
    AND t.is_active = true
    AND t.embedding_768 IS NOT NULL
  ORDER BY t.embedding_768 <=> p_embedding
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION search_template_tools_semantic_768(
  p_template_ids UUID[],
  p_embedding extensions.vector(768),
  p_limit INT DEFAULT 64
)
RETURNS TABLE (tool_id UUID, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT t.id, 1 - (t.embedding_768 <=> p_embedding) AS similarity
  FROM template_tools t
  WHERE t.template_id = ANY(p_template_ids)
    AND t.is_active = true
    AND t.embedding_768 IS NOT NULL
  ORDER BY t.embedding_768 <=> p_embedding
  LIMIT p_limit;
$$;

-- 7. Drop old generic functions (they used the old column name)
DROP FUNCTION IF EXISTS search_tools_semantic(UUID[], extensions.vector(1536), INT);
DROP FUNCTION IF EXISTS search_template_tools_semantic(UUID[], extensions.vector(1536), INT);

-- 8. Add comments
COMMENT ON COLUMN tools.embedding_1536 IS 'OpenAI text-embedding-3-small (1536 dims)';
COMMENT ON COLUMN tools.embedding_768 IS 'Gemini text-embedding-004 or Ollama nomic-embed-text (768 dims)';
COMMENT ON COLUMN template_tools.embedding_1536 IS 'OpenAI text-embedding-3-small (1536 dims)';
COMMENT ON COLUMN template_tools.embedding_768 IS 'Gemini text-embedding-004 or Ollama nomic-embed-text (768 dims)';
