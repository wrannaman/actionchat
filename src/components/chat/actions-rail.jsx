"use client";

import { useState, useEffect } from "react";
import {
  PanelRightClose,
  PanelRight,
  RefreshCw,
  Loader2,
  Activity,
} from "lucide-react";
import { ActionItem } from "./action-item";
import { useRecentActions } from "@/hooks/use-recent-actions";

export function ActionsRail({
  agentId,
  isOpen,
  onToggle,
  onRedoComplete,
}) {
  const { actions, loading, error, refresh, redoAction } = useRecentActions({
    agentId,
    limit: 10,
    pollInterval: 5000, // Refresh every 5 seconds
  });

  const [redoing, setRedoing] = useState(false);

  const handleRedo = async (actionId) => {
    setRedoing(true);
    try {
      const result = await redoAction(actionId);
      onRedoComplete?.(result);
      return result;
    } finally {
      setRedoing(false);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`${
          isOpen ? "w-72" : "w-0"
        } shrink-0 border-l border-white/5 bg-[#0a0a0f] transition-all duration-200 overflow-hidden`}
      >
        <div className="w-72 h-full flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="font-medium text-sm">Recent Actions</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={refresh}
                disabled={loading}
                className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={onToggle}
                className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                title="Close panel"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading && actions.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <div className="text-red-400/70 text-xs mb-2">Failed to load</div>
                <button
                  onClick={refresh}
                  className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Try again
                </button>
              </div>
            ) : actions.length === 0 ? (
              <div className="p-4 text-center text-white/30 text-sm">
                No actions yet
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {actions.map((action) => (
                  <ActionItem
                    key={action.id}
                    action={action}
                    onRedo={handleRedo}
                    disabled={redoing}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer with count */}
          {actions.length > 0 && (
            <div className="p-2 border-t border-white/5 text-center">
              <span className="text-[10px] text-white/30">
                Showing last {actions.length} action{actions.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Toggle button when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute right-2 top-16 z-10 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          title="Show recent actions"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
