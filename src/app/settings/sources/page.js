"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Database, Globe, Wrench, Key, Check, Zap, Minus } from "lucide-react";
import { SkeletonList } from "@/components/ui/skeleton";
import { CredentialModal } from "@/components/chat/credential-modal";
import { toast } from "sonner";
import Link from "next/link";

export default function SourcesSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);
  const [credentialStatus, setCredentialStatus] = useState({});
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/sources");
      if (res.ok) {
        const data = await res.json();
        const srcs = data.sources || [];
        setSources(srcs);
        // Fetch credential status for all sources in parallel
        loadCredentialStatus(srcs);
      } else {
        toast.error("Failed to load sources");
      }
    } catch {
      toast.error("Failed to load sources");
    } finally {
      setLoading(false);
    }
  };

  const loadCredentialStatus = useCallback(async (srcs) => {
    const statusMap = {};
    await Promise.all(
      srcs.map(async (source) => {
        const needsAuth = source.auth_type && source.auth_type !== "none" && source.auth_type !== "passthrough";
        if (!needsAuth) {
          statusMap[source.id] = { has: true, noAuthNeeded: true };
          return;
        }
        try {
          const res = await fetch(`/api/sources/${source.id}/credentials`);
          if (res.ok) {
            const data = await res.json();
            const activeCred = data.credentials?.find((c) => c.is_active);
            statusMap[source.id] = {
              has: data.has_credentials,
              label: activeCred?.label,
              masked: activeCred?.masked_preview,
            };
          }
        } catch (err) {
          console.error(`Failed to check credentials for ${source.name}:`, err);
          statusMap[source.id] = { has: false };
        }
      })
    );
    setCredentialStatus(statusMap);
  }, []);

  const handleCredentialClick = (source) => {
    setSelectedSource(source);
    setCredentialModalOpen(true);
  };

  const handleCredentialSave = async (sourceId) => {
    // Refresh credential status for this source
    try {
      const res = await fetch(`/api/sources/${sourceId}/credentials`);
      if (res.ok) {
        const data = await res.json();
        const activeCred = data.credentials?.find((c) => c.is_active);
        setCredentialStatus((prev) => ({
          ...prev,
          [sourceId]: {
            has: data.has_credentials,
            label: activeCred?.label,
            masked: activeCred?.masked_preview,
          },
        }));
      }
    } catch {
      // Fallback
      setCredentialStatus((prev) => ({
        ...prev,
        [sourceId]: { has: true },
      }));
    }
  };

  const handleCredentialDelete = async (sourceId) => {
    try {
      const res = await fetch(`/api/sources/${sourceId}/credentials`);
      if (res.ok) {
        const data = await res.json();
        const activeCred = data.credentials?.find((c) => c.is_active);
        setCredentialStatus((prev) => ({
          ...prev,
          [sourceId]: {
            has: data.has_credentials,
            label: activeCred?.label,
            masked: activeCred?.masked_preview,
          },
        }));
      }
    } catch {
      setCredentialStatus((prev) => ({
        ...prev,
        [sourceId]: { has: false },
      }));
    }
  };

  const templateSources = sources.filter((s) => s.template_id);
  const customSources = sources.filter((s) => !s.template_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Sources</h1>
          <p className="text-white/50 text-sm mt-1">
            Manage your connected APIs and credentials
          </p>
        </div>
        <Link href="/sources/new">
          <Button className="bg-blue-500 hover:bg-blue-400 text-white font-bold">
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </Link>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : sources.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Database className="h-7 w-7 text-blue-400" />
            </div>
            <h2 className="text-lg font-bold mb-2">No sources yet</h2>
            <p className="text-white/40 mb-4 max-w-sm mx-auto text-sm">
              Add an OpenAPI spec to get started. ActionChat will parse it
              into tools that agents can use.
            </p>
            <Link href="/sources/new">
              <Button className="bg-blue-500 hover:bg-blue-400 text-white font-bold">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Source
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Platform Sources */}
          {templateSources.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                Platform Integrations
              </h2>
              {templateSources.map((source) => {
                const cred = credentialStatus[source.id];
                const needsAuth = source.auth_type && source.auth_type !== "none" && source.auth_type !== "passthrough";
                return (
                  <Card
                    key={source.id}
                    className="bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all cursor-pointer group"
                    onClick={() => handleCredentialClick(source)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center shrink-0">
                            <Zap className="h-4 w-4 text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold group-hover:text-cyan-400 transition-colors">
                              {source.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              {source.base_url && (
                                <span className="flex items-center gap-1 text-xs text-white/30">
                                  <Globe className="h-3 w-3" />
                                  {source.base_url}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-white/5 text-white/50 border-white/10 text-xs">
                            <Wrench className="h-3 w-3 mr-1" />
                            {source.tool_count} endpoints
                          </Badge>
                          {/* Credential status */}
                          {needsAuth && (
                            <div className="flex items-center gap-2">
                              {cred?.has ? (
                                <span className="flex items-center gap-1.5 text-xs text-green-400">
                                  <Check className="h-3 w-3" />
                                  {cred.masked ? (
                                    <span className="font-mono text-white/40">{cred.masked}</span>
                                  ) : (
                                    "Connected"
                                  )}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                                  <Key className="h-3 w-3" />
                                  Add API Key
                                </span>
                              )}
                            </div>
                          )}
                          {!needsAuth && (
                            <span className="flex items-center gap-1 text-xs text-white/20">
                              <Minus className="h-3 w-3" />
                              No auth
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Custom Sources */}
          {customSources.length > 0 && (
            <div className="space-y-3">
              {templateSources.length > 0 && (
                <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                  Your APIs
                </h2>
              )}
              {customSources.map((source) => {
                const cred = credentialStatus[source.id];
                const needsAuth = source.auth_type && source.auth_type !== "none" && source.auth_type !== "passthrough";
                return (
                  <Link key={source.id} href={`/sources/${source.id}`}>
                    <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all cursor-pointer group">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                              <Database className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold group-hover:text-blue-400 transition-colors">
                                {source.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                {source.base_url && (
                                  <span className="flex items-center gap-1 text-xs text-white/30">
                                    <Globe className="h-3 w-3" />
                                    {source.base_url}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-white/5 text-white/50 border-white/10 text-xs">
                              <Wrench className="h-3 w-3 mr-1" />
                              {source.tool_count}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                source.source_type === "openapi"
                                  ? "border-blue-500/30 text-blue-400"
                                  : "border-purple-500/30 text-purple-400"
                              }`}
                            >
                              {source.source_type}
                            </Badge>
                            {/* Credential indicator */}
                            {needsAuth && (
                              cred?.has ? (
                                <Check className="h-3.5 w-3.5 text-green-400" />
                              ) : (
                                <Key className="h-3.5 w-3.5 text-yellow-400" />
                              )
                            )}
                            {!source.is_active && (
                              <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                        {source.description && (
                          <p className="text-xs text-white/30 mt-2 ml-12 line-clamp-1">
                            {source.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Credential Modal — reused from chat */}
      <CredentialModal
        open={credentialModalOpen}
        onOpenChange={setCredentialModalOpen}
        source={selectedSource}
        onSave={handleCredentialSave}
        onDelete={handleCredentialDelete}
      />
    </div>
  );
}
