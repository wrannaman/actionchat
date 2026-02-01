"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, Eye, EyeOff, Zap, Trash2, Share2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getProviders, getModelsForProvider } from "@/lib/ai";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", keyField: "openai_api_key", placeholder: "sk-..." },
  { id: "anthropic", name: "Anthropic", keyField: "anthropic_api_key", placeholder: "sk-ant-..." },
  { id: "google", name: "Google Gemini", keyField: "google_generative_ai_api_key", placeholder: "AIza..." },
  { id: "ollama", name: "Ollama (Local)", keyField: null, placeholder: "http://localhost:11434" },
];

function SettingsContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Simple state
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [keyStatus, setKeyStatus] = useState({ openai: false, anthropic: false, google: false });

  // Routines state
  const [routines, setRoutines] = useState([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutinePrompt, setNewRoutinePrompt] = useState("");
  const [showNewRoutineForm, setShowNewRoutineForm] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchRoutines();
  }, []);

  const fetchRoutines = async () => {
    try {
      const res = await fetch("/api/routines");
      if (res.ok) {
        const data = await res.json();
        setRoutines(data.routines || []);
      }
    } catch {
      console.error("Failed to fetch routines");
    } finally {
      setLoadingRoutines(false);
    }
  };

  const createRoutine = async () => {
    if (!newRoutineName.trim() || !newRoutinePrompt.trim()) return;

    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoutineName.trim(),
          prompt: newRoutinePrompt.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRoutines(prev => [data.routine, ...prev]);
        setNewRoutineName("");
        setNewRoutinePrompt("");
        setShowNewRoutineForm(false);
        toast.success("Routine created!");
      }
    } catch {
      toast.error("Failed to create routine");
    }
  };

  const deleteRoutine = async (id) => {
    try {
      const res = await fetch(`/api/routines/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRoutines(prev => prev.filter(r => r.id !== id));
        toast.success("Routine deleted");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toggleShare = async (routine) => {
    try {
      const res = await fetch(`/api/routines/${routine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_shared: !routine.is_shared }),
      });
      if (res.ok) {
        setRoutines(prev =>
          prev.map(r => r.id === routine.id ? { ...r, is_shared: !r.is_shared } : r)
        );
        toast.success(routine.is_shared ? "Routine unshared" : "Routine shared with team");
      }
    } catch {
      toast.error("Failed to update");
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const settings = data.settings || {};

        // Store which providers have keys
        const status = {
          openai: !!settings.has_openai_key,
          anthropic: !!settings.has_anthropic_key,
          google: !!settings.has_google_key,
        };
        setKeyStatus(status);

        // Use saved provider, or detect from which key exists (NOT ollama by default)
        let detectedProvider = settings.default_provider;
        if (!detectedProvider || detectedProvider === "ollama") {
          if (status.openai) detectedProvider = "openai";
          else if (status.anthropic) detectedProvider = "anthropic";
          else if (status.google) detectedProvider = "google";
          else detectedProvider = "openai"; // fallback to openai, not ollama
        }
        setProvider(detectedProvider);

        // Set model if saved
        if (settings.default_model) {
          setModel(settings.default_model);
        }

        if (settings.ollama_base_url) {
          setOllamaUrl(settings.ollama_base_url);
        }
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    setModel(""); // Reset model when provider changes
    setApiKey(""); // Clear any entered key
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = {
        default_provider: provider,
        default_model: model,
      };

      // Add API key if entered
      const providerConfig = PROVIDERS.find(p => p.id === provider);
      if (provider === "ollama") {
        if (ollamaUrl.trim()) {
          settings.ollama_base_url = ollamaUrl.trim();
        }
      } else if (providerConfig?.keyField && apiKey.trim()) {
        settings[providerConfig.keyField] = apiKey.trim();
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Settings saved");
        setApiKey(""); // Clear the key field
        // Mark provider as configured if we just saved a key
        if (providerConfig?.keyField && apiKey.trim()) {
          setKeyStatus(prev => ({ ...prev, [provider]: true }));
        }
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const providerConfig = PROVIDERS.find(p => p.id === provider);
  const models = getModelsForProvider(provider);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-xl mx-auto space-y-8">
          <h1 className="text-3xl font-black">Settings</h1>

          {/* Routines Section */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-cyan-400" />
                  Routines
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewRoutineForm(!showNewRoutineForm)}
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>
              <p className="text-sm text-white/40">
                Saved prompts you can trigger with <code className="text-cyan-400">/</code> in chat
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Routine Form */}
              {showNewRoutineForm && (
                <div className="p-3 bg-white/5 rounded-lg border border-cyan-500/20 space-y-3">
                  <Input
                    value={newRoutineName}
                    onChange={(e) => setNewRoutineName(e.target.value)}
                    placeholder="Routine name (e.g., Refund Customer)"
                    className="bg-white/5 border-white/10"
                  />
                  <textarea
                    value={newRoutinePrompt}
                    onChange={(e) => setNewRoutinePrompt(e.target.value)}
                    placeholder="Prompt template (e.g., Refund the customer with email [email] for $[amount])"
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewRoutineForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={createRoutine}
                      disabled={!newRoutineName.trim() || !newRoutinePrompt.trim()}
                      className="bg-cyan-500 hover:bg-cyan-400"
                    >
                      Create
                    </Button>
                  </div>
                </div>
              )}

              {/* Routines List */}
              {loadingRoutines ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                </div>
              ) : routines.length === 0 ? (
                <div className="text-center py-6 text-white/30 text-sm">
                  No routines yet. Create one to save time on repeated tasks.
                </div>
              ) : (
                <div className="space-y-2">
                  {routines.map((routine) => (
                    <div
                      key={routine.id}
                      className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white/90">{routine.name}</span>
                            {routine.is_shared && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                Shared
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40 mt-1 truncate font-mono">
                            {routine.prompt}
                          </p>
                          {routine.use_count > 0 && (
                            <p className="text-[10px] text-white/20 mt-1">
                              Used {routine.use_count} time{routine.use_count !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleShare(routine)}
                            className="h-7 w-7 p-0 text-white/30 hover:text-blue-400"
                            title={routine.is_shared ? "Unshare" : "Share with team"}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRoutine(routine.id)}
                            className="h-7 w-7 p-0 text-white/30 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Configuration */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Dropdown */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Dropdown */}
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* API Key or Ollama URL */}
              {provider === "ollama" ? (
                <div className="space-y-2">
                  <Label>Ollama URL</Label>
                  <Input
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="bg-white/5 border-white/10 font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      API Key
                      {keyStatus[provider] && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <Check className="h-3 w-3" />
                          Configured
                        </span>
                      )}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowKey(!showKey)}
                      className="text-white/30 hover:text-white h-6 px-2"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={keyStatus[provider] ? "Enter new key to replace" : providerConfig?.placeholder}
                    className="bg-white/5 border-white/10 font-mono"
                  />
                </div>
              )}

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={saving || !model}
                className="w-full bg-blue-500 hover:bg-blue-400"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {apiKey.trim() ? "Validating..." : "Saving..."}
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
