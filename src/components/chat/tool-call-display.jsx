"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  Copy,
  Check,
  User,
  CreditCard,
  Calendar,
  Hash,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { detectPagination, buildNextPageParams, getPaginationDisplayInfo } from "@/lib/pagination";

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

// Format nested objects for display
function formatNestedValue(key, value, item) {
  // Handle recurring interval specially
  if (key === "recurring" && value && typeof value === "object") {
    if (value.interval) {
      const count = value.interval_count || 1;
      const interval = value.interval;
      if (count === 1) return interval === "month" ? "monthly" : interval === "year" ? "yearly" : interval;
      return `every ${count} ${interval}s`;
    }
    return null;
  }

  // Handle amount with currency from same row
  if (key === "amount" && typeof value === "number") {
    const currency = item?.currency || "usd";
    return formatCurrency(value, currency);
  }

  return null;
}

// Data table for arrays of objects
function DataTable({ data, maxRows = 8 }) {
  const [expanded, setExpanded] = useState(false);

  if (!Array.isArray(data) || data.length === 0) return null;

  // Get all unique keys from all objects
  const allKeys = [...new Set(data.flatMap(item =>
    typeof item === "object" && item ? Object.keys(item) : []
  ))];

  // Prioritize common fields, show more columns
  const priorityKeys = ["id", "name", "email", "status", "amount", "currency", "type", "recurring", "interval", "product", "description", "created", "created_at", "updated_at"];
  // Skip currency as a column since we show it with amount
  const skipKeys = ["currency", "object", "livemode", "metadata"];
  const sortedKeys = [
    ...priorityKeys.filter(k => allKeys.includes(k) && !skipKeys.includes(k)),
    ...allKeys.filter(k => !priorityKeys.includes(k) && !skipKeys.includes(k))
  ].slice(0, 10); // Show up to 10 columns

  const displayData = expanded ? data : data.slice(0, maxRows);

  return (
    <div className="overflow-x-auto -mx-3 px-3">
      <table className="w-full text-xs table-fixed">
        <thead>
          <tr className="border-b border-white/10">
            {sortedKeys.map(key => (
              <th key={key} className="text-left text-white/40 font-medium py-2 px-3 whitespace-nowrap">
                {key.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((item, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              {sortedKeys.map(key => {
                const value = item?.[key];
                const formatted = formatNestedValue(key, value, item);
                return (
                  <td key={key} className="py-2 px-3">
                    {formatted !== null ? (
                      <span className={key === "amount" ? "text-green-400 font-medium" : "text-white/70"}>
                        {formatted}
                      </span>
                    ) : (
                      <SmartValue keyName={key} value={value} />
                    )}
                  </td>
                );
              })}
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
            <><ChevronDown className="h-3 w-3" /> Show less</>
          ) : (
            <><ChevronRight className="h-3 w-3" /> Show all {data.length} rows</>
          )}
        </button>
      )}
    </div>
  );
}

// Smart result renderer
function SmartResult({ data }) {
  // Priority: use _actionchat.response_body (already parsed) over result (often stringified)
  let result;
  if (data?._actionchat?.response_body !== undefined) {
    result = data._actionchat.response_body;
  } else if (data?.result !== undefined) {
    result = data.result;
    // If result is a JSON string, parse it
    if (typeof result === "string" && (result.startsWith("[") || result.startsWith("{"))) {
      try {
        result = JSON.parse(result);
      } catch {
        // Keep as string if parse fails
      }
    }
  } else {
    result = data;
  }

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

export function ToolCallDisplay({ toolName, input, output, state, toolId, sourceId }) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pagination state
  const [pages, setPages] = useState({}); // { 1: data, 2: data, ... }
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [viewMode, setViewMode] = useState("current"); // "current" | "all"

  // Extract method and path - check _actionchat first (for MCP), then parse tool name
  const actionMeta = output?._actionchat;
  let method = "";
  let path = "";
  let displayName = toolName;

  if (actionMeta) {
    method = actionMeta.method || "";
    if (actionMeta.tool_name) {
      displayName = actionMeta.tool_name;
    }
    if (actionMeta.url?.startsWith("mcp://")) {
      path = actionMeta.url.replace("mcp://", "");
    } else {
      path = actionMeta.url || "";
    }
  } else {
    const methodMatch = toolName?.match(/\((GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^)]+)\)/);
    method = methodMatch?.[1] || "";
    path = methodMatch?.[2] || "";
  }

  const hasOutput = state === "output-available" && output;
  const hasError = state === "output-error";
  const isLoading = state === "input-streaming" || state === "input-available";

  // Get the actual data and detect pagination
  const actualData = output?._actionchat?.response_body ?? output?.result ?? output;

  // Initialize pagination on first render with output
  useEffect(() => {
    if (hasOutput && Object.keys(pages).length === 0) {
      const pagination = detectPagination(actualData, input);
      if (pagination) {
        setPaginationMeta(pagination);
        // Extract just the data array for the page cache
        const dataArray = extractDataArrayFromResponse(actualData);
        setPages({ 1: dataArray });
      }
    }
  }, [hasOutput]); // Only run on initial output, not on every data change

  // Get current display data
  const currentPageData = useMemo(() => {
    if (viewMode === "all") {
      // Combine all cached pages
      const allData = [];
      const sortedPages = Object.keys(pages).map(Number).sort((a, b) => a - b);
      for (const pageNum of sortedPages) {
        if (Array.isArray(pages[pageNum])) {
          allData.push(...pages[pageNum]);
        }
      }
      return allData.length > 0 ? allData : actualData;
    }
    return pages[currentPage] || actualData;
  }, [viewMode, pages, currentPage, actualData]);

  const rawJson = hasOutput ? JSON.stringify(currentPageData, null, 2) : "";
  const isJson = rawJson.startsWith("{") || rawJson.startsWith("[");
  const rowCount = Array.isArray(currentPageData) ? currentPageData.length : null;
  const duration = actionMeta?.duration_ms;

  // Calculate total loaded items
  const totalLoadedItems = useMemo(() => {
    return Object.values(pages).reduce((sum, pageData) => {
      return sum + (Array.isArray(pageData) ? pageData.length : 0);
    }, 0);
  }, [pages]);

  const loadedPageCount = Object.keys(pages).length;

  // Fetch next page silently
  const fetchNextPage = useCallback(async () => {
    if (!paginationMeta?.hasMore || isLoadingPage) return;
    if (!toolId && !actionMeta?.tool_id) {
      toast.error("Cannot paginate: tool ID not available");
      return;
    }

    setIsLoadingPage(true);

    try {
      const nextParams = buildNextPageParams(paginationMeta, input);
      const response = await fetch("/api/tools/paginate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: toolId || actionMeta?.tool_id,
          sourceId: sourceId || actionMeta?.source_id,
          input: nextParams,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch page");
      }

      const result = await response.json();
      const newData = result.output?._actionchat?.response_body ?? result.output;
      const newDataArray = extractDataArrayFromResponse(newData);

      // Detect pagination for the new page
      const newPagination = detectPagination(newData, nextParams);

      // Update state
      const nextPageNum = loadedPageCount + 1;
      setPages((prev) => ({ ...prev, [nextPageNum]: newDataArray }));
      setCurrentPage(nextPageNum);

      if (newPagination) {
        setPaginationMeta(newPagination);
      } else {
        // No more pages
        setPaginationMeta((prev) => ({ ...prev, hasMore: false }));
      }
    } catch (error) {
      console.error("[Pagination] Error:", error);
      toast.error(error.message || "Failed to load next page");
    } finally {
      setIsLoadingPage(false);
    }
  }, [paginationMeta, isLoadingPage, toolId, sourceId, actionMeta, input, loadedPageCount]);

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(rawJson);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

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

  // Pagination display info
  const paginationDisplay = paginationMeta
    ? getPaginationDisplayInfo(paginationMeta, totalLoadedItems, loadedPageCount)
    : null;

  return (
    <div className="w-full border border-white/10 rounded bg-white/[0.02] p-3 my-2 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {method && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 font-bold ${
              method === "MCP"
                ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                : METHOD_COLORS[method] || "border-white/30 text-white/60"
            }`}
          >
            {method}
          </Badge>
        )}
        <span className="text-white/80 font-medium">{displayName}</span>
        {path && path !== displayName && (
          <span className="text-white/30 text-[10px] truncate flex-1">{path}</span>
        )}
        {isLoading && (
          <span className="text-blue-400 animate-pulse">calling...</span>
        )}
      </div>

      {/* Input args */}
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

      {/* Output */}
      {hasOutput && (
        <div className="group/output mt-3 border-t border-white/5 pt-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* View toggle tabs */}
              <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
                <button
                  onClick={() => setShowRaw(false)}
                  className={`px-2 py-1 text-[10px] rounded transition-all ${
                    !showRaw ? "bg-white/10 text-white font-medium" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setShowRaw(true)}
                  className={`px-2 py-1 text-[10px] rounded transition-all ${
                    showRaw ? "bg-white/10 text-white font-medium" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  JSON
                </button>
              </div>

              {/* Row count & pagination info */}
              <div className="flex items-center gap-2 text-[10px] text-white/30">
                {paginationDisplay ? (
                  <>
                    <span className="text-white/50">
                      {viewMode === "all"
                        ? `${totalLoadedItems} loaded`
                        : `Page ${currentPage}`}
                      {paginationDisplay.totalCount && (
                        <span className="text-white/30"> of {paginationDisplay.totalCount}</span>
                      )}
                    </span>
                    {paginationDisplay.hasMore && (
                      <span className="text-blue-400/60">• more available</span>
                    )}
                  </>
                ) : (
                  <>
                    {rowCount !== null && <span>{rowCount} rows</span>}
                  </>
                )}
                {duration && <span>{duration}ms</span>}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isJson && (
                <>
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 text-white/30 hover:text-white/60 text-[10px] transition-colors"
                    title="Copy JSON"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1 text-white/30 hover:text-white/60 text-[10px] transition-colors"
                    title="Download JSON"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          {showRaw ? (
            <pre className="text-white/70 whitespace-pre-wrap break-words text-[11px] bg-black/30 rounded-lg p-3 max-h-72 overflow-auto border border-white/5">
              {rawJson}
            </pre>
          ) : (
            <SmartResult data={{ _actionchat: { response_body: currentPageData } }} />
          )}

          {/* Pagination Controls */}
          {paginationMeta && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              {/* Page navigation */}
              <div className="flex items-center gap-2">
                {/* Previous page */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || viewMode === "all"}
                  className={`p-1.5 rounded transition-all ${
                    currentPage <= 1 || viewMode === "all"
                      ? "text-white/20 cursor-not-allowed"
                      : "text-white/50 hover:text-white hover:bg-white/10"
                  }`}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Page indicators */}
                <div className="flex items-center gap-1">
                  {Object.keys(pages)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setCurrentPage(pageNum);
                          setViewMode("current");
                        }}
                        className={`w-6 h-6 rounded text-[10px] transition-all ${
                          viewMode === "current" && currentPage === pageNum
                            ? "bg-blue-500/30 text-blue-400 font-bold"
                            : "text-white/40 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  {paginationMeta.hasMore && (
                    <span className="text-white/20 px-1">...</span>
                  )}
                </div>

                {/* Next page */}
                <button
                  onClick={() => {
                    if (currentPage < loadedPageCount) {
                      setCurrentPage((p) => p + 1);
                      setViewMode("current");
                    } else if (paginationMeta.hasMore) {
                      fetchNextPage();
                    }
                  }}
                  disabled={!paginationMeta.hasMore && currentPage >= loadedPageCount}
                  className={`p-1.5 rounded transition-all ${
                    !paginationMeta.hasMore && currentPage >= loadedPageCount
                      ? "text-white/20 cursor-not-allowed"
                      : "text-white/50 hover:text-white hover:bg-white/10"
                  }`}
                  title={currentPage >= loadedPageCount ? "Load next page" : "Next page"}
                >
                  {isLoadingPage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* View all / Load all buttons */}
              <div className="flex items-center gap-2">
                {loadedPageCount > 1 && (
                  <button
                    onClick={() => setViewMode(viewMode === "all" ? "current" : "all")}
                    className={`px-2 py-1 text-[10px] rounded transition-all ${
                      viewMode === "all"
                        ? "bg-blue-500/20 text-blue-400"
                        : "text-white/40 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {viewMode === "all" ? "View pages" : `View all (${totalLoadedItems})`}
                  </button>
                )}
              </div>
            </div>
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

/**
 * Extract the data array from a response (handles Stripe's {data: [...]}, etc.)
 */
function extractDataArrayFromResponse(response) {
  if (Array.isArray(response)) return response;

  const arrayFields = ["data", "results", "items", "records", "entries", "list", "rows", "objects"];
  for (const field of arrayFields) {
    if (Array.isArray(response?.[field])) {
      return response[field];
    }
  }

  // If it's an object but not an array wrapper, return as single-item array
  if (response && typeof response === "object") {
    return [response];
  }

  return response;
}

/**
 * Display multiple tool calls of the same type grouped into a single table.
 * Used when AI makes multiple parallel calls (e.g., fetch 10 customers separately).
 */
export function GroupedToolCallDisplay({ toolName, parts }) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract metadata from first part
  const firstPart = parts[0];
  const actionMeta = firstPart?.output?._actionchat;
  const method = actionMeta?.method || "";
  const displayName = actionMeta?.tool_name || toolName;

  // Combine all results into a single array
  const combinedResults = parts.flatMap((part) => {
    const output = part.output;
    const data = output?._actionchat?.response_body ?? output?.result ?? output;
    // Parse if stringified
    let parsed = data;
    if (typeof parsed === "string" && (parsed.startsWith("[") || parsed.startsWith("{"))) {
      try { parsed = JSON.parse(parsed); } catch { }
    }
    // Wrap non-arrays
    return Array.isArray(parsed) ? parsed : [parsed];
  }).filter(Boolean);

  const totalDuration = parts.reduce((sum, p) => sum + (p.output?._actionchat?.duration_ms || 0), 0);
  const rawJson = JSON.stringify(combinedResults, null, 2);

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(rawJson);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(displayName || "results").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full border border-white/10 rounded bg-white/[0.02] p-3 my-2 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {method && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 font-bold ${
              method === "MCP"
                ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                : METHOD_COLORS[method] || "border-white/30 text-white/60"
            }`}
          >
            {method}
          </Badge>
        )}
        <span className="text-white/80 font-medium">{displayName}</span>
        <span className="text-white/30 text-[10px]">({parts.length} calls combined)</span>
      </div>

      {/* Results */}
      <div className="mt-3 border-t border-white/5 pt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
              <button
                onClick={() => setShowRaw(false)}
                className={`px-2 py-1 text-[10px] rounded transition-all ${
                  !showRaw ? "bg-white/10 text-white font-medium" : "text-white/40 hover:text-white/60"
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setShowRaw(true)}
                className={`px-2 py-1 text-[10px] rounded transition-all ${
                  showRaw ? "bg-white/10 text-white font-medium" : "text-white/40 hover:text-white/60"
                }`}
              >
                JSON
              </button>
            </div>
            {/* Stats */}
            <div className="flex items-center gap-2 text-[10px] text-white/30">
              <span>{combinedResults.length} rows</span>
              {totalDuration > 0 && <span>{totalDuration}ms total</span>}
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="text-white/30 hover:text-white/60 text-[10px] transition-colors"
              title="Copy JSON"
            >
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            </button>
            <button
              onClick={handleDownload}
              className="text-white/30 hover:text-white/60 text-[10px] transition-colors"
              title="Download JSON"
            >
              <Download className="h-3 w-3" />
            </button>
          </div>
        </div>

        {showRaw ? (
          <pre className="text-white/70 whitespace-pre-wrap break-words text-[11px] bg-black/30 rounded-lg p-3 max-h-72 overflow-auto border border-white/5">
            {rawJson}
          </pre>
        ) : (
          <SmartResult data={{ _actionchat: { response_body: combinedResults } }} />
        )}
      </div>
    </div>
  );
}
