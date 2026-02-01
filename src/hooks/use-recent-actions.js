"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Hook to fetch and manage recent actions from the action_log.
 * @param {Object} options
 * @param {string} options.agentId - Filter by agent ID
 * @param {number} options.limit - Max actions to fetch (default 10)
 * @param {number} options.pollInterval - Auto-refresh interval in ms (default 0 = no polling)
 */
export function useRecentActions({ agentId, limit = 10, pollInterval = 0 } = {}) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (agentId) params.set("agent_id", agentId);

      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch actions: ${res.status}`);
      }

      const data = await res.json();
      setActions(data.actions || []);
      setError(null);
    } catch (err) {
      console.error("[useRecentActions] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agentId, limit]);

  // Initial fetch
  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // Optional polling
  useEffect(() => {
    if (pollInterval <= 0) return;

    const interval = setInterval(fetchActions, pollInterval);
    return () => clearInterval(interval);
  }, [fetchActions, pollInterval]);

  // Redo an action
  const redoAction = useCallback(async (actionId) => {
    const res = await fetch("/api/tools/redo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to redo action");
    }

    // Refresh actions list
    await fetchActions();
    return res.json();
  }, [fetchActions]);

  return {
    actions,
    loading,
    error,
    refresh: fetchActions,
    redoAction,
  };
}
