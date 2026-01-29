"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Database, Globe, Clock, Wrench } from "lucide-react";
import { SkeletonList } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";

function SourcesContent() {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      } else {
        toast.error("Failed to load sources");
      }
    } catch {
      toast.error("Failed to load sources");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black mb-2">API Sources</h1>
              <p className="text-white/40">
                Connect OpenAPI specs to give your agents access to real APIs
              </p>
            </div>
            <Link href="/sources/new">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
                <Plus className="h-4 w-4 mr-2" />
                Add Source
              </Button>
            </Link>
          </div>

          {loading ? (
            <SkeletonList count={3} />
          ) : sources.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                  <Database className="h-8 w-8 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">No sources yet</h2>
                <p className="text-white/40 mb-6 max-w-md mx-auto">
                  Add an OpenAPI spec to get started. ActionChat will parse it
                  into tools that agents can use to execute API calls.
                </p>
                <Link href="/sources/new">
                  <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Source
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sources.map((source) => (
                <Link key={source.id} href={`/sources/${source.id}`}>
                  <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all cursor-pointer group">
                    <CardContent className="py-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Database className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">
                              {source.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              {source.base_url && (
                                <span className="flex items-center gap-1 text-xs text-white/30">
                                  <Globe className="h-3 w-3" />
                                  {source.base_url}
                                </span>
                              )}
                              {source.last_synced_at && (
                                <span className="flex items-center gap-1 text-xs text-white/30">
                                  <Clock className="h-3 w-3" />
                                  Synced {new Date(source.last_synced_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-white/5 text-white/50 border-white/10">
                            <Wrench className="h-3 w-3 mr-1" />
                            {source.tool_count} {source.tool_count === 1 ? "tool" : "tools"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              source.source_type === "openapi"
                                ? "border-blue-500/30 text-blue-400"
                                : "border-purple-500/30 text-purple-400"
                            }
                          >
                            {source.source_type}
                          </Badge>
                          {!source.is_active && (
                            <Badge variant="outline" className="border-red-500/30 text-red-400">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                      {source.description && (
                        <p className="text-sm text-white/30 mt-3 ml-14 line-clamp-1">
                          {source.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SourcesPage() {
  return (
    <AuthGuard>
      <SourcesContent />
    </AuthGuard>
  );
}
