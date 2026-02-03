"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Database, Globe, Clock, Wrench } from "lucide-react";
import { SkeletonList } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";

export default function SourcesSettingsPage() {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Sources</h1>
          <p className="text-white/50 text-sm mt-1">
            Connect OpenAPI specs to give your agents access to real APIs
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
        <div className="space-y-3">
          {sources.map((source) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
