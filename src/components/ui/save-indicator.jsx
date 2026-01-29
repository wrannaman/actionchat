"use client";

import { Check, Loader2, AlertCircle } from "lucide-react";

/**
 * Minimal save status indicator.
 * Shows: nothing (idle), spinner (saving), checkmark (saved), error icon (error)
 */
export function SaveIndicator({ status, className = "" }) {
  if (status === "idle") {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono transition-opacity duration-300 ${className}`}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-white/30" />
          <span className="text-white/30">saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3 text-green-400" />
          <span className="text-green-400/70">saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3 w-3 text-red-400" />
          <span className="text-red-400/70">error</span>
        </>
      )}
    </span>
  );
}
