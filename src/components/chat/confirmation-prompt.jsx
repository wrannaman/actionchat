"use client";

import { Badge } from "@/components/ui/badge";

export function ConfirmationPrompt({
  toolName,
  input,
  approvalId,
  onApprove,
  onReject,
  responded,
  approved,
}) {
  // Extract method and path from tool description
  const methodMatch = toolName?.match(
    /\((GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^)]+)\)/
  );
  const method = methodMatch?.[1] || "ACTION";
  const path = methodMatch?.[2] || toolName;

  return (
    <div className="border-l-4 border-yellow-500 bg-yellow-500/5 rounded-r p-3 my-2 font-mono text-xs">
      {/* Warning header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-yellow-400 font-bold">⚠ CONFIRM</span>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 font-bold border-red-500/30 text-red-400 bg-red-500/10"
        >
          {method}
        </Badge>
        <span className="text-white/60">{path}</span>
      </div>

      {/* Args */}
      {input && Object.keys(input).length > 0 && (
        <div className="mb-3">
          <span className="text-white/30">args: </span>
          <pre className="text-cyan-400/80 whitespace-pre-wrap break-words mt-1">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}

      {/* Action buttons or status */}
      {responded ? (
        <div
          className={`text-sm font-bold ${approved ? "text-green-400" : "text-red-400"}`}
        >
          {approved ? "✓ Confirmed" : "✗ Rejected"}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onApprove?.(approvalId)}
            className="px-3 py-1 rounded border border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500/60 transition-colors text-xs font-bold"
          >
            [Y] Confirm
          </button>
          <button
            onClick={() => onReject?.(approvalId)}
            className="px-3 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-colors text-xs font-bold"
          >
            [N] Reject
          </button>
        </div>
      )}
    </div>
  );
}
