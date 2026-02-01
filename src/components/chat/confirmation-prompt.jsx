"use client";

import { Badge } from "@/components/ui/badge";
import {
  User,
  CreditCard,
  ShoppingCart,
  RefreshCw,
  FileText,
  Package,
  Webhook,
  Key,
  Box,
  AlertTriangle,
  Trash2,
  DollarSign,
  Shield,
  Link,
} from "lucide-react";
import {
  generateImpactPreview,
  formatCurrency,
} from "@/lib/impact-preview";

const ICON_MAP = {
  User,
  CreditCard,
  ShoppingCart,
  RefreshCw,
  FileText,
  Package,
  Webhook,
  Key,
  Box,
};

const WARNING_ICONS = {
  destructive: Trash2,
  cascade: Link,
  financial: DollarSign,
  security: Shield,
};

// Entity card component
function EntityCard({ details, icon }) {
  const IconComponent = ICON_MAP[icon] || Box;

  // Generate initials for avatar
  const initials = details.name
    ? details.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : details.email
      ? details.email[0].toUpperCase()
      : "?";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
      {/* Avatar/Icon */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-white text-sm font-bold">
        {details.name || details.email ? initials : <IconComponent className="w-5 h-5 text-white/60" />}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        {details.name && (
          <div className="text-white font-medium truncate">{details.name}</div>
        )}
        {details.email && (
          <div className="text-white/50 text-xs truncate">{details.email}</div>
        )}
        {details.id && (
          <div className="text-white/30 text-[10px] font-mono truncate">
            ID: {details.id}
          </div>
        )}
        {details.amount && (
          <div className="text-green-400 font-medium text-sm mt-1">
            {formatCurrency(details.amount, details.currency)}
          </div>
        )}
        {details.status && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">
            {details.status}
          </span>
        )}
      </div>
    </div>
  );
}

// Warning badge component
function WarningBadge({ type, message }) {
  const IconComponent = WARNING_ICONS[type] || AlertTriangle;

  return (
    <div className="flex items-center gap-2 text-yellow-400/90 text-xs">
      <IconComponent className="w-3.5 h-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

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

  // Generate impact preview
  const preview = generateImpactPreview(toolName, method, input);
  const hasDetails = preview.details && (
    preview.details.id || preview.details.name || preview.details.email || preview.details.amount
  );

  return (
    <div className="border-l-4 border-yellow-500 bg-yellow-500/5 rounded-r p-3 my-2 font-mono text-xs">
      {/* Warning header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-yellow-400 font-bold">CONFIRM</span>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 font-bold border-red-500/30 text-red-400 bg-red-500/10"
        >
          {method}
        </Badge>
        <span className="text-white/60">{path}</span>
      </div>

      {/* Impact summary */}
      {hasDetails && (
        <div className="mb-3 space-y-2">
          <div className="text-white/50 text-[11px] mb-2">{preview.summary}:</div>
          <EntityCard details={preview.details} icon={preview.icon} />
        </div>
      )}

      {/* Raw args (only if no rich preview) */}
      {!hasDetails && input && Object.keys(input).length > 0 && (
        <div className="mb-3">
          <span className="text-white/30">args: </span>
          <pre className="text-cyan-400/80 whitespace-pre-wrap break-words mt-1">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="mb-3 space-y-1 py-2 border-t border-white/5">
          {preview.warnings.map((warning, i) => (
            <WarningBadge key={i} type={warning.type} message={warning.message} />
          ))}
        </div>
      )}

      {/* Action buttons or status */}
      {responded ? (
        <div
          className={`text-sm font-bold ${approved ? "text-green-400" : "text-red-400"}`}
        >
          {approved ? "Confirmed" : "Rejected"}
        </div>
      ) : (
        <div className="flex items-center gap-3 pt-2 border-t border-white/5">
          <button
            onClick={() => onApprove?.(approvalId)}
            className="px-3 py-1.5 rounded border border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500/60 transition-colors text-xs font-bold cursor-pointer"
          >
            [Y] Confirm
          </button>
          <button
            onClick={() => onReject?.(approvalId)}
            className="px-3 py-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-colors text-xs font-bold cursor-pointer"
          >
            [N] Reject
          </button>
        </div>
      )}
    </div>
  );
}
