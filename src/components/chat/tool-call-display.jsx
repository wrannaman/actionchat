"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

const METHOD_COLORS = {
  GET: "border-green-500/30 text-green-400 bg-green-500/10",
  POST: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  PUT: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  PATCH: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  DELETE: "border-red-500/30 text-red-400 bg-red-500/10",
};

export function ToolCallDisplay({ toolName, input, output, state }) {
  const [expanded, setExpanded] = useState(false);

  // Extract method and path from tool name/description
  const methodMatch = toolName?.match(/\((GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^)]+)\)/);
  const method = methodMatch?.[1] || "";
  const path = methodMatch?.[2] || "";

  const hasOutput = state === "output-available" && output;
  const hasError = state === "output-error";
  const isStreaming = state === "input-streaming";

  // Try to extract result text from output
  let resultText = "";
  if (hasOutput) {
    if (typeof output === "string") {
      resultText = output;
    } else if (output?.result) {
      resultText = typeof output.result === "string"
        ? output.result
        : JSON.stringify(output.result, null, 2);
    } else {
      resultText = JSON.stringify(output, null, 2);
    }
  }

  const isLong = resultText.length > 300;
  const displayText = expanded ? resultText : resultText.slice(0, 300);

  // Check if result looks like JSON
  const isJson = resultText.startsWith("{") || resultText.startsWith("[");

  const handleDownload = () => {
    const blob = new Blob([resultText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Create filename from path or toolName
    const filename = (path || toolName || "response")
      .replace(/[^a-z0-9]/gi, "-")
      .replace(/-+/g, "-")
      .toLowerCase();
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-white/10 rounded bg-white/[0.02] p-3 my-2 font-mono text-xs">
      {/* Header: method badge + path */}
      <div className="flex items-center gap-2 mb-1">
        {method && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 font-bold ${METHOD_COLORS[method] || "border-white/30 text-white/60"}`}
          >
            {method}
          </Badge>
        )}
        <span className="text-white/60">{path || toolName}</span>
        {isStreaming && (
          <span className="text-blue-400 animate-pulse">preparing...</span>
        )}
      </div>

      {/* Input args */}
      {input && Object.keys(input).length > 0 && (
        <div className="mt-2">
          <span className="text-white/30">args: </span>
          <span className="text-cyan-400/80">
            {JSON.stringify(input, null, 2)}
          </span>
        </div>
      )}

      {/* Output */}
      {hasOutput && (
        <div className="group/output mt-2 border-t border-white/5 pt-2 relative">
          <div className="flex items-center justify-between">
            <span className="text-white/30">result: </span>
            {isJson && (
              <button
                onClick={handleDownload}
                className="opacity-0 group-hover/output:opacity-100 transition-opacity text-white/20 hover:text-white/50 p-1 -m-1"
                title="Download JSON"
              >
                <Download className="h-3 w-3" />
              </button>
            )}
          </div>
          <pre className="text-white/70 whitespace-pre-wrap break-words mt-1">
            {displayText}
            {isLong && !expanded && "..."}
          </pre>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-blue-400 hover:text-blue-300 text-[10px] mt-1 flex items-center gap-1"
            >
              {expanded ? (
                <>
                  <ChevronDown className="h-3 w-3" /> collapse
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" /> show more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="mt-2 text-red-400">
          Error executing tool
        </div>
      )}
    </div>
  );
}
