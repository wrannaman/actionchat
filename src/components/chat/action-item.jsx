"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Check, X, Clock, Loader2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const METHOD_COLORS = {
  GET: "border-green-500/30 text-green-400 bg-green-500/10",
  POST: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  PUT: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  PATCH: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  DELETE: "border-red-500/30 text-red-400 bg-red-500/10",
  MCP: "border-purple-500/30 text-purple-400 bg-purple-500/10",
};

const STATUS_CONFIG = {
  completed: {
    icon: Check,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  failed: {
    icon: X,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  executing: {
    icon: Loader2,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    animate: true,
  },
  pending_confirmation: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  confirmed: {
    icon: Clock,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  rejected: {
    icon: X,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
};

export function ActionItem({ action, onRedo, disabled }) {
  const [redoing, setRedoing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const statusConfig = STATUS_CONFIG[action.status] || STATUS_CONFIG.completed;
  const StatusIcon = statusConfig.icon;
  const methodColor = METHOD_COLORS[action.method] || METHOD_COLORS.GET;

  // Parse tool name for display
  const displayName = action.tool_name
    ?.replace(/\(.*\)/, "") // Remove method+path suffix
    .trim() || "Unknown Action";

  // Format relative time
  const timeAgo = formatDistanceToNow(new Date(action.created_at), { addSuffix: true });

  // Check if action can be redone
  const canRedo = ["completed", "failed"].includes(action.status) && action.request_body;

  // Check if this is a dangerous action
  const isDangerous = ["POST", "PUT", "PATCH", "DELETE"].includes(action.method);

  const handleRedoClick = () => {
    if (isDangerous && action.requires_confirmation) {
      setShowConfirm(true);
    } else {
      performRedo();
    }
  };

  const performRedo = async () => {
    setRedoing(true);
    setShowConfirm(false);
    try {
      await onRedo(action.id);
      toast.success("Action re-executed");
    } catch (err) {
      toast.error(err.message || "Failed to redo action");
    } finally {
      setRedoing(false);
    }
  };

  return (
    <div className="group px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
      <div className="flex items-start gap-2">
        {/* Status icon */}
        <div className={`p-1 rounded ${statusConfig.bgColor} shrink-0`}>
          <StatusIcon
            className={`w-3.5 h-3.5 ${statusConfig.color} ${statusConfig.animate ? "animate-spin" : ""}`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Tool name + method badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[9px] px-1 py-0 font-bold shrink-0 ${methodColor}`}
            >
              {action.method}
            </Badge>
            <span className="text-white/80 text-xs truncate" title={displayName}>
              {displayName}
            </span>
          </div>

          {/* Timestamp + response status */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/30 text-[10px]">{timeAgo}</span>
            {action.response_status && (
              <span
                className={`text-[10px] ${
                  action.response_status >= 200 && action.response_status < 300
                    ? "text-green-400/60"
                    : "text-red-400/60"
                }`}
              >
                {action.response_status}
              </span>
            )}
            {action.duration_ms && (
              <span className="text-white/20 text-[10px]">{action.duration_ms}ms</span>
            )}
          </div>
        </div>

        {/* Redo button */}
        {canRedo && (
          <button
            onClick={handleRedoClick}
            disabled={disabled || redoing}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Redo this action"
          >
            {redoing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Inline confirmation for dangerous redo */}
      {showConfirm && (
        <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center gap-2 text-yellow-400 text-xs mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Re-execute this action?</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={performRedo}
              disabled={redoing}
              className="px-2 py-1 text-[10px] rounded bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors cursor-pointer"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-2 py-1 text-[10px] rounded bg-white/5 text-white/50 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error message if failed */}
      {action.status === "failed" && action.error_message && (
        <div className="mt-1.5 text-[10px] text-red-400/70 truncate" title={action.error_message}>
          {action.error_message}
        </div>
      )}
    </div>
  );
}
