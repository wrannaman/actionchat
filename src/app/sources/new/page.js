"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, ArrowRight, Check, ChevronDown, Upload, Wrench, Sparkles, Code } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TemplateBrowser } from "@/components/templates/template-browser";

function NewSourceContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("templates");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    base_url: "",
    source_type: "openapi",
    auth_type: "passthrough",
    spec_text: "",
    spec_url: "",
  });
  const [parsePreview, setParsePreview] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [nameError, setNameError] = useState("");

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleUrlFetch = async () => {
    const url = urlInput.trim();
    if (!url) {
      toast.error("Enter a URL");
      return;
    }

    setFetching(true);
    setParseError(null);
    setParsePreview(null);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        setParseError(`Failed to fetch: ${res.status} ${res.statusText}`);
        setFetching(false);
        return;
      }

      const text = await res.text();
      let spec;
      try {
        spec = JSON.parse(text);
      } catch {
        setParseError("Invalid JSON response. Make sure the URL returns an OpenAPI spec.");
        setFetching(false);
        return;
      }

      if (!spec.openapi || !spec.paths) {
        setParseError('Invalid OpenAPI spec: missing "openapi" or "paths" field');
        setFetching(false);
        return;
      }

      // Parse tool count
      let toolCount = 0;
      const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
      for (const pathItem of Object.values(spec.paths)) {
        for (const method of methods) {
          if (pathItem[method]) toolCount++;
        }
      }

      // Auto-fill form
      setForm({
        name: spec.info?.title || "",
        description: spec.info?.description || "",
        base_url: spec.servers?.[0]?.url || "",
        source_type: "openapi",
        auth_type: "passthrough",
        spec_text: text,
        spec_url: url,
      });

      setParsePreview({
        title: spec.info?.title || "Untitled API",
        version: spec.info?.version || "?",
        pathCount: Object.keys(spec.paths).length,
        toolCount,
        baseUrl: spec.servers?.[0]?.url || "",
      });

      toast.success(`Found ${toolCount} API endpoints`);
    } catch (err) {
      setParseError(`Failed to fetch: ${err.message}`);
    } finally {
      setFetching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUrlFetch();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      try {
        const spec = JSON.parse(text);
        if (!spec.openapi || !spec.paths) {
          setParseError('Invalid OpenAPI spec: missing "openapi" or "paths" field');
          return;
        }

        let toolCount = 0;
        const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
        for (const pathItem of Object.values(spec.paths)) {
          for (const method of methods) {
            if (pathItem[method]) toolCount++;
          }
        }

        setForm({
          name: spec.info?.title || "",
          description: spec.info?.description || "",
          base_url: spec.servers?.[0]?.url || "",
          source_type: "openapi",
          auth_type: "passthrough",
          spec_text: text,
          spec_url: "",
        });

        setParsePreview({
          title: spec.info?.title || "Untitled API",
          version: spec.info?.version || "?",
          pathCount: Object.keys(spec.paths).length,
          toolCount,
          baseUrl: spec.servers?.[0]?.url || "",
        });

        toast.success(`Found ${toolCount} API endpoints`);
      } catch {
        setParseError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setNameError("Name is required");
      return;
    }

    if (form.source_type === "openapi" && !form.spec_text.trim()) {
      toast.error("Fetch a spec first");
      return;
    }

    setSaving(true);
    try {
      let specContent = null;
      if (form.spec_text.trim()) {
        try {
          specContent = JSON.parse(form.spec_text);
        } catch {
          toast.error("Invalid JSON in spec");
          setSaving(false);
          return;
        }
      }

      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          base_url: form.base_url.trim(),
          source_type: form.source_type,
          auth_type: form.auth_type,
          spec_content: specContent,
          spec_url: form.spec_url.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Created with ${data.source?.tool_count || 0} tools`);
        router.push(`/sources/${data.source.id}`);
      } else {
        toast.error(data.error || "Failed to create");
      }
    } catch {
      toast.error("Failed to create source");
    } finally {
      setSaving(false);
    }
  };

  const handleManualSource = async () => {
    if (!form.name.trim()) {
      setNameError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          base_url: form.base_url.trim(),
          source_type: "manual",
          auth_type: form.auth_type,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Source created — add tools manually");
        router.push(`/sources/${data.source.id}`);
      } else {
        toast.error(data.error || "Failed to create");
      }
    } catch {
      toast.error("Failed to create source");
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateSuccess = (source) => {
    router.push(`/sources/${source.id}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Link
              href="/sources"
              className="flex items-center gap-1 text-sm text-white/40 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sources
            </Link>
            <h1 className="text-3xl font-black mb-2">Add API Source</h1>
            <p className="text-white/40">
              Choose from our catalog or add your own OpenAPI spec
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 p-1 mb-6">
              <TabsTrigger
                value="templates"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Browse Catalog
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white"
              >
                <Code className="w-4 h-4 mr-2" />
                Custom API
              </TabsTrigger>
            </TabsList>

            {/* Templates Tab */}
            <TabsContent value="templates" className="mt-0">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-6">
                  <TemplateBrowser onSourceCreated={handleTemplateSuccess} />
                </CardContent>
              </Card>

              <p className="text-center text-white/30 text-sm mt-4">
                Don&apos;t see what you need?{" "}
                <button
                  onClick={() => setActiveTab("custom")}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Add a custom API
                </button>
              </p>
            </TabsContent>

            {/* Custom API Tab */}
            <TabsContent value="custom" className="mt-0">
              {/* Main URL Input */}
              <Card className="bg-white/5 border-white/10 mb-6">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://api.example.com/openapi.json"
                        className="bg-white/5 border-white/10 text-lg h-12 flex-1"
                        autoFocus={activeTab === "custom"}
                      />
                      <Button
                        onClick={handleUrlFetch}
                        disabled={fetching || !urlInput.trim()}
                        className="h-12 px-6 bg-blue-500 hover:bg-blue-400 text-white"
                      >
                        {fetching ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <ArrowRight className="h-5 w-5" />
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-white/30">
                      <span>or</span>
                      <label className="cursor-pointer hover:text-white/50 transition-colors">
                        <input
                          type="file"
                          accept=".json,.yaml,.yml"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <span className="flex items-center gap-1">
                          <Upload className="h-3.5 w-3.5" />
                          upload a file
                        </span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error */}
              {parseError && (
                <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 text-sm">
                  {parseError}
                </div>
              )}

              {/* Success Preview */}
              {parsePreview && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Card className="bg-white/5 border-green-500/30 border">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                          <Check className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Input
                            value={form.name}
                            onChange={(e) => {
                              updateField("name", e.target.value);
                              if (e.target.value.trim()) setNameError("");
                            }}
                            onBlur={() => {
                              if (!form.name.trim()) setNameError("Name is required");
                            }}
                            className={`bg-transparent border-none text-xl font-bold p-0 h-auto focus-visible:ring-0 ${nameError ? "text-red-400" : ""}`}
                            placeholder="API Name"
                          />
                          {nameError ? (
                            <p className="text-xs text-red-400 mt-1">{nameError}</p>
                          ) : (
                            <p className="text-sm text-white/40 mt-1">
                              {parsePreview.toolCount} endpoints from {parsePreview.pathCount} paths
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div className="text-white/40">
                          Version: <span className="text-white/70">{parsePreview.version}</span>
                        </div>
                        {parsePreview.baseUrl && (
                          <div className="text-white/40 truncate">
                            Base: <span className="text-white/70">{parsePreview.baseUrl}</span>
                          </div>
                        )}
                      </div>

                      {/* Advanced toggle */}
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-1 text-xs text-white/30 hover:text-white/50 transition-colors"
                      >
                        <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                        {showAdvanced ? 'Hide' : 'Show'} advanced options
                      </button>

                      {showAdvanced && (
                        <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-white/40">Description</Label>
                            <Textarea
                              value={form.description}
                              onChange={(e) => updateField("description", e.target.value)}
                              className="bg-white/5 border-white/10 text-sm min-h-[60px]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-white/40">Base URL</Label>
                              <Input
                                value={form.base_url}
                                onChange={(e) => updateField("base_url", e.target.value)}
                                className="bg-white/5 border-white/10 text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-white/40">Auth Type</Label>
                              <Select
                                value={form.auth_type}
                                onValueChange={(v) => updateField("auth_type", v)}
                              >
                                <SelectTrigger className="bg-white/5 border-white/10 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="passthrough">Passthrough</SelectItem>
                                  <SelectItem value="bearer">Bearer Token</SelectItem>
                                  <SelectItem value="api_key">API Key</SelectItem>
                                  <SelectItem value="basic">Basic Auth</SelectItem>
                                  <SelectItem value="none">None</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Button
                    type="submit"
                    disabled={saving || !form.name.trim()}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold text-lg"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Source
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Manual source option */}
              {!parsePreview && (
                <div className="mt-8 pt-8 border-t border-white/10">
                  <p className="text-sm text-white/30 mb-4">
                    Don&apos;t have an OpenAPI spec? Create a manual source and add endpoints one by one.
                  </p>
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <Input
                        value={form.name}
                        onChange={(e) => {
                          updateField("name", e.target.value);
                          if (e.target.value.trim()) setNameError("");
                        }}
                        onBlur={() => {
                          if (!form.name.trim() && form.name !== "") setNameError("Name is required");
                        }}
                        placeholder="Source name"
                        className={`bg-white/5 flex-1 ${nameError ? "border-red-500/50" : "border-white/10"}`}
                      />
                      <Button
                        onClick={handleManualSource}
                        disabled={saving || !form.name.trim()}
                        variant="outline"
                        className="border-white/10"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Wrench className="h-4 w-4 mr-2" />
                            Create Manual
                          </>
                        )}
                      </Button>
                    </div>
                    {nameError && (
                      <p className="text-xs text-red-400">{nameError}</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

export default function NewSourcePage() {
  return (
    <AuthGuard>
      <NewSourceContent />
    </AuthGuard>
  );
}
