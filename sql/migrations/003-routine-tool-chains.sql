-- Migration: Add tool chain tracking to routines
-- Date: 2025-02-04
-- Purpose: Track which tools were used in a routine for pre-loading and confidence scoring

-- Add tool_chain column: Array of tool_ids in execution order
ALTER TABLE routines ADD COLUMN IF NOT EXISTS tool_chain UUID[] DEFAULT '{}';

-- Add tool_chain_names column: Denormalized tool names for display/search
ALTER TABLE routines ADD COLUMN IF NOT EXISTS tool_chain_names TEXT[] DEFAULT '{}';

-- Add success/failure tracking for confidence scoring
ALTER TABLE routines ADD COLUMN IF NOT EXISTS success_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;

-- Add embedding column for semantic matching of queries to routines
ALTER TABLE routines ADD COLUMN IF NOT EXISTS embedding_1536 vector(1536);

-- Index for embedding search (HNSW for fast similarity)
CREATE INDEX IF NOT EXISTS idx_routines_embedding_1536 ON routines
  USING hnsw (embedding_1536 vector_cosine_ops)
  WHERE embedding_1536 IS NOT NULL;

COMMENT ON COLUMN routines.tool_chain IS 'Ordered array of tool UUIDs used in this routine';
COMMENT ON COLUMN routines.tool_chain_names IS 'Denormalized tool names for display without join';
COMMENT ON COLUMN routines.success_count IS 'Number of successful executions of this routine';
COMMENT ON COLUMN routines.failure_count IS 'Number of failed executions of this routine';
COMMENT ON COLUMN routines.embedding_1536 IS 'OpenAI embedding for semantic matching of user queries';

-- Search routines by semantic similarity
CREATE OR REPLACE FUNCTION search_routines_semantic_1536(
  p_org_id UUID,
  p_embedding vector(1536),
  p_limit INT DEFAULT 3
)
RETURNS TABLE (routine_id UUID, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT r.id, 1 - (r.embedding_1536 <=> p_embedding) AS similarity
  FROM routines r
  WHERE r.org_id = p_org_id
    AND r.embedding_1536 IS NOT NULL
  ORDER BY r.embedding_1536 <=> p_embedding
  LIMIT p_limit;
$$;

-- Atomically increment routine feedback counters (avoids race conditions)
CREATE OR REPLACE FUNCTION increment_routine_feedback(
  p_routine_id UUID,
  p_is_success BOOLEAN
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_is_success THEN
    UPDATE routines SET success_count = success_count + 1 WHERE id = p_routine_id;
  ELSE
    UPDATE routines SET failure_count = failure_count + 1 WHERE id = p_routine_id;
  END IF;
END;
$$;
