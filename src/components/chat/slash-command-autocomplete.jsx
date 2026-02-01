"use client";

import { Badge } from "@/components/ui/badge";
import { getParameterHints } from "@/lib/slash-command-parser";

const METHOD_COLORS = {
  GET: "border-green-500/30 text-green-400 bg-green-500/10",
  POST: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  PUT: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  PATCH: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  DELETE: "border-red-500/30 text-red-400 bg-red-500/10",
  MCP: "border-purple-500/30 text-purple-400 bg-purple-500/10",
};

export function SlashCommandAutocomplete({
  suggestions,
  selectedIndex,
  onSelect,
  onHover,
}) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#0d0d12] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
      {suggestions.map((tool, index) => {
        // Extract method from tool name or use default
        const methodMatch = tool.name?.match(/\((GET|POST|PUT|PATCH|DELETE|MCP)\s/);
        const method = methodMatch?.[1] || tool.method || "GET";
        const methodColor = METHOD_COLORS[method] || METHOD_COLORS.GET;

        // Clean name for display
        const displayName = tool.name
          ?.replace(/\([^)]*\)/, "")
          .trim() || tool.path || "Unknown";

        // Get parameter hints
        const paramHints = getParameterHints(tool);

        return (
          <div
            key={tool.id}
            className={`px-3 py-2 cursor-pointer transition-colors ${
              index === selectedIndex
                ? "bg-blue-500/20 border-l-2 border-blue-500"
                : "hover:bg-white/5 border-l-2 border-transparent"
            }`}
            onClick={() => onSelect(tool)}
            onMouseEnter={() => onHover?.(index)}
          >
            <div className="flex items-center gap-2">
              {/* Method badge */}
              <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 font-bold shrink-0 ${methodColor}`}
              >
                {method}
              </Badge>

              {/* Tool name */}
              <span className="text-white/90 text-sm font-medium">
                {displayName}
              </span>

              {/* Risk indicator */}
              {tool.requires_confirmation && (
                <span className="text-yellow-400 text-[10px]" title="Requires confirmation">

                </span>
              )}
            </div>

            {/* Description */}
            {tool.description && (
              <div className="text-white/40 text-xs mt-0.5 truncate ml-9">
                {tool.description}
              </div>
            )}

            {/* Parameter hints */}
            {paramHints && (
              <div className="text-cyan-400/60 text-[10px] font-mono mt-1 ml-9">
                {paramHints}
              </div>
            )}
          </div>
        );
      })}

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-white/5 border-t border-white/5 text-[10px] text-white/30 flex items-center gap-4">
        <span><kbd className="px-1 py-0.5 rounded bg-white/10">Tab</kbd> to select</span>
        <span><kbd className="px-1 py-0.5 rounded bg-white/10"></kbd><kbd className="px-1 py-0.5 rounded bg-white/10 ml-0.5"></kbd> to navigate</span>
        <span><kbd className="px-1 py-0.5 rounded bg-white/10">Esc</kbd> to close</span>
      </div>
    </div>
  );
}
