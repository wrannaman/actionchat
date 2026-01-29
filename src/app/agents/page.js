"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, Database, Cpu, Thermometer } from "lucide-react";
import { SkeletonList } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  ollama: "Ollama",
};

function AgentsContent() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      } else {
        toast.error("Failed to load agents");
      }
    } catch {
      toast.error("Failed to load agents");
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
              <h1 className="text-3xl font-black mb-2">Agents</h1>
              <p className="text-white/40">
                Configured bots that use your API sources to execute operations
              </p>
            </div>
            <Link href="/agents/new">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
                <Plus className="h-4 w-4 mr-2" />
                New Agent
              </Button>
            </Link>
          </div>

          {loading ? (
            <SkeletonList count={3} />
          ) : agents.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                  <Bot className="h-8 w-8 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">No agents yet</h2>
                <p className="text-white/40 mb-6 max-w-md mx-auto">
                  Create an agent and link it to API sources. Agents translate
                  natural language into API calls.
                </p>
                <Link href="/agents/new">
                  <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Agent
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <Link key={agent.id} href={`/agents/${agent.id}`}>
                  <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all cursor-pointer group">
                    <CardContent className="py-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Bot className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">
                              {agent.name}
                            </h3>
                            {agent.description && (
                              <p className="text-sm text-white/30 line-clamp-1 mt-0.5">
                                {agent.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-white/5 text-white/50 border-white/10">
                            <Database className="h-3 w-3 mr-1" />
                            {agent.source_count} {agent.source_count === 1 ? "source" : "sources"}
                          </Badge>
                          <Badge variant="outline" className="border-white/10 text-white/40">
                            <Cpu className="h-3 w-3 mr-1" />
                            {PROVIDER_LABELS[agent.model_provider] || agent.model_provider}
                          </Badge>
                          <Badge variant="outline" className="border-white/10 text-white/40 font-mono text-xs">
                            {agent.model_name}
                          </Badge>
                          {!agent.is_active && (
                            <Badge variant="outline" className="border-red-500/30 text-red-400">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
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

export default function AgentsPage() {
  return (
    <AuthGuard>
      <AgentsContent />
    </AuthGuard>
  );
}
