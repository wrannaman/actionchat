"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, Database, Cpu } from "lucide-react";
import { SkeletonList } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  ollama: "Ollama",
};

export default function AgentsSettingsPage() {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-white/50 text-sm mt-1">
            Configured bots that use your API sources to execute operations
          </p>
        </div>
        <Link href="/agents/new">
          <Button className="bg-blue-500 hover:bg-blue-400 text-white font-bold">
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </Link>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : agents.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Bot className="h-7 w-7 text-blue-400" />
            </div>
            <h2 className="text-lg font-bold mb-2">No agents yet</h2>
            <p className="text-white/40 mb-4 max-w-sm mx-auto text-sm">
              Create an agent and link it to API sources. Agents translate
              natural language into API calls.
            </p>
            <Link href="/agents/new">
              <Button className="bg-blue-500 hover:bg-blue-400 text-white font-bold">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all cursor-pointer group">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold group-hover:text-blue-400 transition-colors">
                          {agent.name}
                        </h3>
                        {agent.description && (
                          <p className="text-xs text-white/30 line-clamp-1 mt-0.5">
                            {agent.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-white/5 text-white/50 border-white/10 text-xs">
                        <Database className="h-3 w-3 mr-1" />
                        {agent.source_count}
                      </Badge>
                      <Badge variant="outline" className="border-white/10 text-white/40 text-xs">
                        <Cpu className="h-3 w-3 mr-1" />
                        {PROVIDER_LABELS[agent.model_provider] || agent.model_provider}
                      </Badge>
                      <Badge variant="outline" className="border-white/10 text-white/40 font-mono text-xs">
                        {agent.model_name}
                      </Badge>
                      {!agent.is_active && (
                        <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
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
  );
}
