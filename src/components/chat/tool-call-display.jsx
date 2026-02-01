"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Download, Copy, Check, User, CreditCard, Calendar, Hash } from "lucide-react";
import { toast } from "sonner";

const METHOD_COLORS = {
  GET: "border-green-500/30 text-green-400 bg-green-500/10",
  POST: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  PUT: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  PATCH: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  DELETE: "border-red-500/30 text-red-400 bg-red-500/10",
};

// Format currency values
function formatCurrency(amount, currency = "USD") {
  if (typeof amount !== "number") return amount;
  // Handle cents (Stripe-style)
  const value = amount > 1000 && Number.isInteger(amount) ? amount / 100 : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

// Format timestamps
function formatDate(value) {
  if (!value) return null;
  // Unix timestamp (seconds)
  if (typeof value === "number" && value > 1000000000 && value < 2000000000) {
    return new Date(value * 1000).toLocaleString();
  }
  // Unix timestamp (milliseconds)
  if (typeof value === "number" && value > 1000000000000) {
    return new Date(value).toLocaleString();
  }
  // ISO string
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleString();
  }
  return null;
}

// Detect if a value looks like an ID
function looksLikeId(key, value) {
  if (typeof value !== "string") return false;
  const idKeys = ["id", "_id", "uuid", "key", "token", "secret"];
  const keyLower = key.toLowerCase();
  return idKeys.some(k => keyLower === k || keyLower.endsWith("_" + k) || keyLower.endsWith("Id"));
}

// Detect if object looks like a user/customer
function looksLikeUser(obj) {
  if (!obj || typeof obj !== "object") return false;
  const userFields = ["email", "name", "username", "first_name", "firstName"];
  return userFields.some(f => f in obj);
}

// Detect if object looks like a payment/transaction
function looksLikePayment(obj) {
  if (!obj || typeof obj !== "object") return false;
  const paymentFields = ["amount", "currency", "status"];
  const matches = paymentFields.filter(f => f in obj);
  return matches.length >= 2;
}

// Copyable value component
function CopyableValue({ value, className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`group/copy inline-flex items-center gap-1 hover:text-white transition-colors ${className}`}
      title="Click to copy"
    >
      <span className="font-mono">{value.length > 24 ? value.slice(0, 12) + "..." + value.slice(-8) : value}</span>
      {copied ? (
        <Check className="w-3 h-3 text-green-400" />
      ) : (
        <Copy className="w-3 h-3 opacity-0 group-hover/copy:opacity-50" />
      )}
    </button>
  );
}

// User card component
function UserCard({ data }) {
  const name = data.name || data.username || `${data.first_name || ""} ${data.last_name || ""}`.trim();
  const email = data.email;
  const id = data.id || data._id;

  return (
    <div className="flex items-center gap-3 p-2 rounded bg-white/5 border border-white/10">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
        {name ? name[0].toUpperCase() : <User className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        {name && <div className="text-white text-sm font-medium truncate">{name}</div>}
        {email && <div className="text-white/50 text-xs truncate">{email}</div>}
      </div>
      {id && <CopyableValue value={String(id)} className="text-white/30 text-[10px]" />}
    </div>
  );
}

// Payment card component
function PaymentCard({ data }) {
  const amount = data.amount;
  const currency = data.currency || "usd";
  const status = data.status;
  const id = data.id || data.payment_intent;

  const statusColors = {
    succeeded: "text-green-400 bg-green-500/10",
    pending: "text-yellow-400 bg-yellow-500/10",
    failed: "text-red-400 bg-red-500/10",
    canceled: "text-white/40 bg-white/5",
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded bg-white/5 border border-white/10">
      <div className="w-8 h-8 rounded bg-green-500/20 flex items-center justify-center">
        <CreditCard className="w-4 h-4 text-green-400" />
      </div>
      <div className="flex-1">
        <div className="text-white text-sm font-medium">{formatCurrency(amount, currency)}</div>
        {status && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColors[status] || "text-white/50 bg-white/5"}`}>
            {status}
          </span>
        )}
      </div>
      {id && <CopyableValue value={String(id)} className="text-white/30 text-[10px]" />}
    </div>
  );
}

// Smart value renderer
function SmartValue({ keyName, value }) {
  // Null/undefined
  if (value === null || value === undefined) {
    return <span className="text-white/30 italic">null</span>;
  }

  // Boolean
  if (typeof value === "boolean") {
    return <span className={value ? "text-green-400" : "text-red-400"}>{String(value)}</span>;
  }

  // ID-like strings
  if (looksLikeId(keyName, value)) {
    return <CopyableValue value={value} className="text-purple-400" />;
  }

  // Timestamps
  const formattedDate = formatDate(value);
  if (formattedDate) {
    return (
      <span className="inline-flex items-center gap-1 text-blue-400">
        <Calendar className="w-3 h-3" />
        {formattedDate}
      </span>
    );
  }

  // Currency (if key suggests it)
  if (typeof value === "number" && /amount|price|total|cost|balance/i.test(keyName)) {
    return <span className="text-green-400 font-medium">{formatCurrency(value)}</span>;
  }

  // Status fields
  if (keyName === "status" && typeof value === "string") {
    const statusColors = {
      active: "text-green-400 bg-green-500/10",
      succeeded: "text-green-400 bg-green-500/10",
      completed: "text-green-400 bg-green-500/10",
      pending: "text-yellow-400 bg-yellow-500/10",
      processing: "text-yellow-400 bg-yellow-500/10",
      failed: "text-red-400 bg-red-500/10",
      canceled: "text-white/40 bg-white/5",
      inactive: "text-white/40 bg-white/5",
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[value] || "text-white/60 bg-white/5"}`}>
        {value}
      </span>
    );
  }

  // Default string/number
  if (typeof value === "string" || typeof value === "number") {
    return <span className="text-white/70">{String(value)}</span>;
  }

  // Arrays - show count
  if (Array.isArray(value)) {
    return <span className="text-white/50">[{value.length} items]</span>;
  }

  // Objects - show key count
  if (typeof value === "object") {
    return <span className="text-white/50">{"{...}"}</span>;
  }

  return <span className="text-white/50">{String(value)}</span>;
}

// Data table for arrays of objects
function DataTable({ data, maxRows = 5 }) {
  const [expanded, setExpanded] = useState(false);

  if (!Array.isArray(data) || data.length === 0) return null;

  // Get all unique keys from all objects
  const allKeys = [...new Set(data.flatMap(item =>
    typeof item === "object" && item ? Object.keys(item) : []
  ))];

  // Prioritize common fields, limit columns
  const priorityKeys = ["id", "name", "email", "status", "amount", "created", "created_at"];
  const sortedKeys = [
    ...priorityKeys.filter(k => allKeys.includes(k)),
    ...allKeys.filter(k => !priorityKeys.includes(k))
  ].slice(0, 5);

  const displayData = expanded ? data : data.slice(0, maxRows);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10">
            {sortedKeys.map(key => (
              <th key={key} className="text-left text-white/40 font-medium py-1.5 px-2 first:pl-0">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((item, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              {sortedKeys.map(key => (
                <td key={key} className="py-1.5 px-2 first:pl-0">
                  <SmartValue keyName={key} value={item?.[key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-blue-400 hover:text-blue-300 text-[10px] mt-2 flex items-center gap-1"
        >
          {expanded ? (
            <><ChevronDown className="h-3 w-3" /> show less</>
          ) : (
            <><ChevronRight className="h-3 w-3" /> +{data.length - maxRows} more</>
          )}
        </button>
      )}
    </div>
  );
}

// Smart result renderer
function SmartResult({ data }) {
  // Handle wrapped result
  const result = data?.result !== undefined ? data.result : data;

  // Empty states
  if (result === null || result === undefined) {
    return <span className="text-white/40 italic">null</span>;
  }
  if (Array.isArray(result) && result.length === 0) {
    return <span className="text-white/40 italic">(empty list)</span>;
  }
  if (typeof result === "object" && Object.keys(result).length === 0) {
    return <span className="text-white/40 italic">(empty)</span>;
  }

  // Array of objects → table
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === "object") {
    // Check if they look like users
    if (result.every(item => looksLikeUser(item))) {
      return (
        <div className="space-y-2">
          {result.slice(0, 5).map((user, i) => (
            <UserCard key={i} data={user} />
          ))}
          {result.length > 5 && (
            <div className="text-white/30 text-xs">+{result.length - 5} more</div>
          )}
        </div>
      );
    }
    return <DataTable data={result} />;
  }

  // Single user object
  if (looksLikeUser(result)) {
    return <UserCard data={result} />;
  }

  // Single payment object
  if (looksLikePayment(result)) {
    return <PaymentCard data={result} />;
  }

  // Object with key-value pairs
  if (typeof result === "object" && !Array.isArray(result)) {
    const entries = Object.entries(result);
    if (entries.length <= 8) {
      return (
        <div className="space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-white/40 shrink-0">{key}:</span>
              <SmartValue keyName={key} value={value} />
            </div>
          ))}
        </div>
      );
    }
  }

  // Fallback to JSON
  const jsonStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return <pre className="text-white/70 whitespace-pre-wrap break-words">{jsonStr}</pre>;
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-white/10 rounded w-3/4" />
      <div className="h-4 bg-white/10 rounded w-1/2" />
      <div className="h-4 bg-white/10 rounded w-2/3" />
    </div>
  );
}

export function ToolCallDisplay({ toolName, input, output, state }) {
  const [showRaw, setShowRaw] = useState(false);

  // Extract method and path from tool name/description
  const methodMatch = toolName?.match(/\((GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^)]+)\)/);
  const method = methodMatch?.[1] || "";
  const path = methodMatch?.[2] || "";

  const hasOutput = state === "output-available" && output;
  const hasError = state === "output-error";
  const isLoading = state === "input-streaming" || state === "input-available";

  // Get raw JSON for download
  const rawJson = hasOutput ? JSON.stringify(output?.result ?? output, null, 2) : "";
  const isJson = rawJson.startsWith("{") || rawJson.startsWith("[");

  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
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
        <span className="text-white/60 flex-1">{path || toolName}</span>
        {isLoading && (
          <span className="text-blue-400 animate-pulse">calling...</span>
        )}
      </div>

      {/* Input args - smart rendering */}
      {input && Object.keys(input).length > 0 && (
        <div className="mt-2 space-y-1">
          {Object.entries(input).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-white/30 shrink-0">{key}:</span>
              <SmartValue keyName={key} value={value} />
            </div>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <LoadingSkeleton />
        </div>
      )}

      {/* Output - smart rendering */}
      {hasOutput && (
        <div className="group/output mt-3 border-t border-white/5 pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/30">result</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="text-white/20 hover:text-white/50 text-[10px] transition-colors"
              >
                {showRaw ? "formatted" : "raw"}
              </button>
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
          </div>
          {showRaw ? (
            <pre className="text-white/70 whitespace-pre-wrap break-words text-[11px] bg-black/20 rounded p-2 max-h-64 overflow-auto">
              {rawJson}
            </pre>
          ) : (
            <SmartResult data={output} />
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
