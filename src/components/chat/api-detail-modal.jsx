"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Key, Check, Zap, ExternalLink, RefreshCw, Power } from "lucide-react";
import { toast } from "sonner";

const METHOD_COLORS = {
  GET: "bg-green-500/20 text-green-400 border-green-500/30",
  POST: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PUT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  PATCH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function ApiDetailModal({
  open,
  onOpenChange,
  source,
  credentialInfo,
  onManageCredentials,
  isEnabled = true,
  onToggleEnabled,
  enabledCount = 1, // How many APIs are currently enabled (for warning)
}) {
  // Template-based sources don't need sync - tools come from platform-level template_tools
  const isTemplateBased = !!source?.template_id;
  const hasCredentials = credentialInfo?.has;
  const isLastEnabled = isEnabled && enabledCount === 1;
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (open && source?.id) {
      loadTools();
    }
  }, [open, source?.id]);

  const loadTools = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/tools`);
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools || []);
      }
    } catch (err) {
      console.error("Failed to load tools:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      let body = {};

      // If this is the internal mock API, fetch fresh spec from the endpoint
      const baseUrl = source?.base_url || "";
      if (baseUrl.includes("/api/mock")) {
        try {
          const specUrl = `${window.location.origin}/api/mock/openapi.json`;
          const specRes = await fetch(specUrl);
          if (specRes.ok) {
            const freshSpec = await specRes.json();
            body.spec_content = freshSpec;
          }
        } catch (e) {
          console.warn("Failed to fetch fresh mock spec:", e);
        }
      }

      const res = await fetch(`/api/sources/${source.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.changed) {
          toast.success(`Synced: +${data.inserted} new, ${data.updated} updated, ${data.removed} removed`);
          // Reload tools to show the new ones
          await loadTools();
        } else {
          toast.info("Already up to date");
        }
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch (err) {
      console.error("Failed to sync:", err);
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const needsAuth = source?.auth_type && source.auth_type !== "none" && source.auth_type !== "passthrough";
  const isMcp = source?.source_type === "mcp";

  // Group tools by tag or method
  const groupedTools = tools.reduce((acc, tool) => {
    const tag = tool.tags?.[0] || "General";
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(tool);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d0d12] border-white/10 text-white sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            {source?.name}
          </DialogTitle>
        </DialogHeader>

        {/* Enable/Disable toggle */}
        {onToggleEnabled && (
          <div
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              isEnabled
                ? isLastEnabled
                  ? "bg-yellow-500/10 border-yellow-500/20"
                  : "bg-blue-500/10 border-blue-500/20"
                : "bg-white/5 border-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <Power className={`w-4 h-4 ${isEnabled ? (isLastEnabled ? "text-yellow-400" : "text-blue-400") : "text-white/40"}`} />
              <div className="flex flex-col">
                <span className={`text-sm ${isEnabled ? (isLastEnabled ? "text-yellow-300" : "text-blue-300") : "text-white/60"}`}>
                  {isEnabled ? "Active" : "Disabled"}
                </span>
                <span className="text-xs text-white/40">
                  {isLastEnabled
                    ? "Last enabled API - disabling will remove all tools"
                    : isEnabled
                      ? "AI can use these endpoints"
                      : "Hidden from AI"}
                </span>
              </div>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={() => onToggleEnabled(source?.id)}
            />
          </div>
        )}

        {/* Auth status */}
        {needsAuth && (
          <div
            className={`flex items-center justify-between p-3 rounded-lg border ${
              hasCredentials
                ? "bg-green-500/10 border-green-500/20"
                : "bg-yellow-500/10 border-yellow-500/20"
            }`}
          >
            <div className="flex items-center gap-2">
              {hasCredentials ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <div className="flex flex-col">
                    <span className="text-sm text-green-300">
                      {credentialInfo?.label || "Credentials configured"}
                    </span>
                    {credentialInfo?.masked && (
                      <span className="text-xs text-green-300/60 font-mono">
                        {credentialInfo.masked}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 text-yellow-400" />
                  <div className="flex flex-col">
                    <span className="text-sm text-yellow-300">Credentials required</span>
                    <span className="text-xs text-yellow-300/60">
                      {source?.auth_type === "bearer" && "Bearer token"}
                      {source?.auth_type === "api_key" && `API key (${source?.auth_config?.header_name || "X-API-Key"})`}
                      {source?.auth_type === "basic" && "Basic auth"}
                    </span>
                  </div>
                </>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                onManageCredentials();
              }}
              className="text-white/60 hover:text-white"
            >
              {hasCredentials ? "Update" : "Add"}
            </Button>
          </div>
        )}

        {/* Endpoints list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-white/50" />
            </div>
          ) : tools.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              No {isMcp ? "tools" : "endpoints"} found
            </div>
          ) : (
            Object.entries(groupedTools).map(([tag, tagTools]) => (
              <div key={tag}>
                {Object.keys(groupedTools).length > 1 && (
                  <div className="text-xs text-white/30 uppercase tracking-wider mb-2">
                    {tag}
                  </div>
                )}
                <div className="space-y-1">
                  {tagTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 font-bold shrink-0 ${
                            METHOD_COLORS[tool.method] || "border-white/30 text-white/60"
                          }`}
                        >
                          {tool.method}
                        </Badge>
                        <span className="text-sm text-white/80 font-mono truncate">
                          {tool.path}
                        </span>
                        {tool.risk_level === "dangerous" && (
                          <Badge className="text-[9px] px-1 py-0 bg-red-500/20 text-red-400 border-red-500/30">
                            Confirm
                          </Badge>
                        )}
                      </div>
                      {tool.description && (
                        <p className="text-xs text-white/40 mt-1 line-clamp-2">
                          {tool.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-white/5">
          <span className="text-xs text-white/30">
            {tools.length} {isMcp ? "tool" : "endpoint"}{tools.length === 1 ? "" : "s"} available
          </span>
          <div className="flex gap-2">
            {/* Only show sync for custom (non-template) OpenAPI sources */}
            {!isMcp && !isTemplateBased && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={syncing || loading}
                className="text-white/50 hover:text-white"
                title="Re-fetch from OpenAPI spec"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync"}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/50"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
