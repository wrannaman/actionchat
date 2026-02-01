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
import { Loader2, Check, Eye, EyeOff } from "lucide-react";
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

  useEffect(() => {
    fetchSettings();
  }, []);

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
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-black mb-8">Settings</h1>

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
