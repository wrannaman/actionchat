"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, ArrowRight, Globe, ChevronDown, Database } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful operations assistant. Be concise. Always include IDs in your responses.";

// Default models per provider
const DEFAULT_MODELS = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-4.5",
  google: "gemini-3-flash",
  ollama: "llama3.2",
};

function NewAgentContent() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [availableSources, setAvailableSources] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [name, setName] = useState("");
  const [form, setForm] = useState({
    description: "",
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    model_provider: "",
    model_name: "",
    temperature: 0.1,
  });
  const [selectedSources, setSelectedSources] = useState({});
  const [nameError, setNameError] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    fetchSources();
    fetchDefaultProvider();
  }, []);

  const fetchDefaultProvider = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const defaultProvider = data.settings?.default_provider || "openai";
        const defaultModel = data.settings?.default_model || DEFAULT_MODELS[defaultProvider] || "gpt-5-mini";
        setForm((prev) => ({
          ...prev,
          model_provider: defaultProvider,
          model_name: defaultModel,
        }));
      }
    } catch {
      // Fall back to openai
      setForm((prev) => ({
        ...prev,
        model_provider: "openai",
        model_name: "gpt-5-mini",
      }));
    } finally {
      setSettingsLoaded(true);
    }
  };

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/sources");
      if (res.ok) {
        const data = await res.json();
        setAvailableSources(data.sources || []);
      }
    } catch {
      // ignore
    } finally {
      setSourcesLoading(false);
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSource = (sourceId) => {
    setSelectedSources((prev) => {
      if (prev[sourceId]) {
        const next = { ...prev };
        delete next[sourceId];
        return next;
      }
      return { ...prev, [sourceId]: "read_write" };
    });
  };

  const setSourcePermission = (sourceId, permission) => {
    setSelectedSources((prev) => ({
      ...prev,
      [sourceId]: permission,
    }));
  };

  const MODEL_OPTIONS = {
    openai: [
      { value: "gpt-5.2", label: "GPT-5.2" },
      { value: "gpt-5.2-pro", label: "GPT-5.2 Pro" },
      { value: "gpt-5-mini", label: "GPT-5 Mini" },
      { value: "gpt-5-nano", label: "GPT-5 Nano" },
    ],
    anthropic: [
      { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
      { value: "claude-opus-4.5", label: "Claude Opus 4.5" },
      { value: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
    ],
    google: [
      { value: "gemini-3-pro", label: "Gemini 3 Pro" },
      { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
      { value: "gemini-3-flash", label: "Gemini 3 Flash" },
    ],
    ollama: [
      { value: "llama3.2", label: "Llama 3.2" },
      { value: "llama3.1", label: "Llama 3.1" },
      { value: "llama3", label: "Llama 3" },
      { value: "mistral", label: "Mistral" },
      { value: "mixtral", label: "Mixtral" },
      { value: "qwen2.5", label: "Qwen 2.5" },
      { value: "codellama", label: "Code Llama" },
      { value: "deepseek-r1", label: "DeepSeek R1" },
    ],
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const sourceLinks = Object.entries(selectedSources).map(
        ([source_id, permission]) => ({ source_id, permission })
      );

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: name.trim(),
          description: form.description.trim(),
          source_links: sourceLinks,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Agent created");
        router.push(`/agents/${data.agent.id}`);
      } else {
        toast.error(data.error || "Failed to create agent");
      }
    } catch {
      toast.error("Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectedCount = Object.keys(selectedSources).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <Link
              href="/agents"
              className="flex items-center gap-1 text-sm text-white/40 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Agents
            </Link>
            <h1 className="text-3xl font-black mb-2">New Agent</h1>
            <p className="text-white/40">
              Name it, pick your APIs, and you&apos;re done
            </p>
          </div>

          {/* Name Input */}
          <Card className={`bg-white/5 mb-6 ${nameError ? "border-red-500/50" : "border-white/10"}`}>
            <CardContent className="pt-6">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setNameError("");
                }}
                onBlur={() => {
                  if (!name.trim()) setNameError("Name is required");
                }}
                onKeyDown={handleKeyDown}
                placeholder="What should we call this agent?"
                className={`bg-white/5 text-lg h-12 ${nameError ? "border-red-500/50" : "border-white/10"}`}
                autoFocus
              />
              {nameError && (
                <p className="text-xs text-red-400 mt-2">{nameError}</p>
              )}
            </CardContent>
          </Card>

          {/* Source Selection */}
          <Card className="bg-white/5 border-white/10 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-4 w-4 text-white/40" />
                <span className="text-sm font-medium">API Sources</span>
                {selectedCount > 0 && (
                  <span className="text-xs text-blue-400 ml-auto">
                    {selectedCount} selected
                  </span>
                )}
              </div>

              {sourcesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                </div>
              ) : availableSources.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-white/30 text-sm mb-3">No sources yet</p>
                  <Link href="/sources/new">
                    <Button variant="outline" size="sm" className="border-white/10">
                      Add a Source First
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableSources.map((source) => {
                    const isSelected = !!selectedSources[source.id];
                    const permission = selectedSources[source.id] || "read_write";
                    return (
                      <div
                        key={source.id}
                        onClick={() => toggleSource(source.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "bg-white/[0.02] border-white/5 hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSource(source.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <p className="font-medium text-sm">{source.name}</p>
                            {source.base_url && (
                              <p className="text-xs text-white/30 flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {source.base_url}
                              </p>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Select
                            value={permission}
                            onValueChange={(v) => setSourcePermission(source.id, v)}
                          >
                            <SelectTrigger
                              className="w-[110px] h-7 text-xs bg-white/5 border-white/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="read">Read Only</SelectItem>
                              <SelectItem value="read_write">Read + Write</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-white/30 hover:text-white/50 transition-colors mb-4"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <Card className="bg-white/5 border-white/10 mb-6">
              <CardContent className="pt-6 space-y-6">
                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/40">Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="What does this agent do?"
                    className="bg-white/5 border-white/10 text-sm"
                  />
                </div>

                {/* System Prompt */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/40">System Prompt</Label>
                  <Textarea
                    value={form.system_prompt}
                    onChange={(e) => updateField("system_prompt", e.target.value)}
                    className="bg-white/5 border-white/10 min-h-[80px] text-sm"
                  />
                </div>

                {/* Model */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-white/40">Provider</Label>
                    <Select
                      value={form.model_provider}
                      onValueChange={(v) => {
                        updateField("model_provider", v);
                        const firstModel = MODEL_OPTIONS[v]?.[0]?.value;
                        if (firstModel) updateField("model_name", firstModel);
                      }}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google (Gemini)</SelectItem>
                        <SelectItem value="ollama">Ollama</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-white/40">Model</Label>
                    <Select
                      value={form.model_name}
                      onValueChange={(v) => updateField("model_name", v)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(MODEL_OPTIONS[form.model_provider] || []).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-white/40">Temperature</Label>
                    <span className="text-xs text-white/30 font-mono">
                      {form.temperature.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[form.temperature]}
                    onValueChange={([v]) => updateField("temperature", v)}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-white/20">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold text-lg"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                Create Agent
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}

export default function NewAgentPage() {
  return (
    <AuthGuard>
      <NewAgentContent />
    </AuthGuard>
  );
}
