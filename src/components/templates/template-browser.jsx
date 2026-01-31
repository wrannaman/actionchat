"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  Star,
  Zap,
  ExternalLink,
  ArrowRight,
  Check,
  Server,
  Package,
} from "lucide-react";
import { toast } from "sonner";

function TemplateCard({ template, onSelect, compact = false }) {
  const isMcp = template.type === "mcp";

  if (compact) {
    return (
      <button
        onClick={() => onSelect(template)}
        className="group flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all text-left w-full"
      >
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center shrink-0 group-hover:from-white/10 group-hover:to-white/15 transition-colors">
          <span className="text-white/80 text-sm font-bold">{template.name.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium text-sm truncate">{template.name}</span>
            {template.is_featured && <Star className="w-3 h-3 text-yellow-500 shrink-0" />}
          </div>
          <p className="text-white/40 text-xs truncate">{template.use_cases[0]}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-cyan-400 transition-colors shrink-0" />
      </button>
    );
  }

  return (
    <button
      onClick={() => onSelect(template)}
      className="group relative p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all text-left"
    >
      {template.is_featured && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded">
          <Star className="w-2.5 h-2.5 text-yellow-500" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center shrink-0 group-hover:from-white/10 group-hover:to-white/15 transition-colors">
          <span className="text-white/80 font-bold">{template.name.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium truncate">{template.name}</h3>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                isMcp
                  ? "bg-purple-500/10 text-purple-400"
                  : "bg-blue-500/10 text-blue-400"
              }`}
            >
              {isMcp ? "MCP" : "API"}
            </span>
          </div>
          <p className="text-white/40 text-xs line-clamp-2 mb-2">{template.description}</p>
          <div className="flex items-center gap-1 text-[10px] text-white/30">
            <Zap className="w-2.5 h-2.5 text-cyan-400" />
            {template.use_cases[0]}
          </div>
        </div>
      </div>
    </button>
  );
}

function CredentialForm({ template, onSubmit, loading }) {
  const [credentials, setCredentials] = useState({});
  const [customFields, setCustomFields] = useState({});
  const authConfig = template.auth_config || {};

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ credentials, ...customFields });
  };

  const renderCredentialFields = () => {
    switch (template.auth_type) {
      case "bearer":
        return (
          <div className="space-y-2">
            <label className="text-sm text-white/60">{authConfig.credential_label || "API Token"}</label>
            <Input
              type="password"
              value={credentials.token || ""}
              onChange={(e) => setCredentials({ ...credentials, token: e.target.value })}
              placeholder={authConfig.credential_placeholder || "Enter token..."}
              className="bg-white/5 border-white/10"
              required
            />
          </div>
        );

      case "api_key":
        return (
          <div className="space-y-2">
            <label className="text-sm text-white/60">{authConfig.credential_label || "API Key"}</label>
            <Input
              type="password"
              value={credentials.api_key || ""}
              onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
              placeholder={authConfig.credential_placeholder || "Enter API key..."}
              className="bg-white/5 border-white/10"
              required
            />
          </div>
        );

      case "basic":
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm text-white/60">{authConfig.username_label || "Username"}</label>
              <Input
                type="text"
                value={credentials.username || ""}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                placeholder={authConfig.username_placeholder || "Enter username..."}
                className="bg-white/5 border-white/10"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/60">{authConfig.password_label || "Password"}</label>
              <Input
                type="password"
                value={credentials.password || ""}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                placeholder={authConfig.password_placeholder || "Enter password..."}
                className="bg-white/5 border-white/10"
              />
            </div>
          </>
        );

      case "none":
        // For MCP or no-auth, check for connection string
        if (authConfig.credential_field) {
          return (
            <div className="space-y-2">
              <label className="text-sm text-white/60">{authConfig.credential_label || "Connection"}</label>
              <Input
                type="password"
                value={credentials[authConfig.credential_field] || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, [authConfig.credential_field]: e.target.value })
                }
                placeholder={authConfig.credential_placeholder || "Enter value..."}
                className="bg-white/5 border-white/10"
                required
              />
            </div>
          );
        }
        return (
          <p className="text-sm text-white/40">This integration doesn&apos;t require credentials.</p>
        );

      default:
        return (
          <p className="text-sm text-white/40">Configure credentials after setup.</p>
        );
    }
  };

  // Check for URL placeholders like {subdomain}
  const hasPlaceholders = template.base_url?.includes("{");
  const placeholders = hasPlaceholders
    ? template.base_url.match(/\{(\w+)\}/g)?.map((p) => p.slice(1, -1)) || []
    : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {placeholders.map((placeholder) => (
        <div key={placeholder} className="space-y-2">
          <label className="text-sm text-white/60 capitalize">{placeholder.replace("_", " ")}</label>
          <Input
            type="text"
            value={customFields[placeholder] || ""}
            onChange={(e) => setCustomFields({ ...customFields, [placeholder]: e.target.value })}
            placeholder={`Enter ${placeholder}...`}
            className="bg-white/5 border-white/10"
            required
          />
        </div>
      ))}

      {renderCredentialFields()}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Installing...
          </>
        ) : (
          <>
            Install {template.name}
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </form>
  );
}

function InstallDialog({ template, open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState(null);

  const handleInstall = async (data) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${template.slug}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (res.ok) {
        setSuccess(true);
        setResult(json);
        toast.success(json.message || `Installed ${template.name}`);
      } else {
        toast.error(json.error || "Failed to install");
      }
    } catch (err) {
      toast.error("Failed to install: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (success && result) {
      onSuccess?.(result.source);
    }
    setSuccess(false);
    setResult(null);
    onOpenChange(false);
  };

  if (!template) return null;

  const isMcp = template.type === "mcp";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0d0d12] border-white/10 text-white max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center">
              <span className="text-white/80 text-lg font-bold">{template.name.charAt(0)}</span>
            </div>
            <div>
              <DialogTitle className="text-lg">{template.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    isMcp
                      ? "bg-purple-500/10 text-purple-400"
                      : "bg-blue-500/10 text-blue-400"
                  }`}
                >
                  {isMcp ? "MCP Server" : "OpenAPI"}
                </span>
                <span className="text-white/30 text-xs capitalize">
                  {template.category?.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
          <DialogDescription className="text-white/50 text-sm">
            {template.description}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Installed!</h3>
            <p className="text-white/50 text-sm mb-4">
              {result?.source?.tool_count || 0} tools ready to use
            </p>
            <Button onClick={handleClose} className="bg-white/10 hover:bg-white/15">
              Done
            </Button>
          </div>
        ) : (
          <>
            {/* Use cases preview */}
            <div className="mb-4 p-3 bg-white/[0.02] rounded-lg border border-white/5">
              <p className="text-xs text-white/40 mb-2">What you can do:</p>
              <div className="flex flex-wrap gap-1.5">
                {template.use_cases.slice(0, 4).map((uc, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-white/5 rounded text-xs text-white/60"
                  >
                    {uc}
                  </span>
                ))}
              </div>
            </div>

            {/* Credential form */}
            <CredentialForm template={template} onSubmit={handleInstall} loading={loading} />

            {/* Docs link */}
            {template.docs_url && (
              <div className="text-center pt-2">
                <a
                  href={template.docs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/30 hover:text-cyan-400 inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View {template.name} docs
                </a>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TemplateBrowser({ onSourceCreated, compact = false, limit = null }) {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/templates");
        const data = await res.json();
        if (data.ok) {
          setTemplates(data.templates);
          setCategories(data.categories);
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.use_cases.some((uc) => uc.toLowerCase().includes(searchLower))
      );
    }

    if (selectedCategory) {
      result = result.filter((t) => t.category === selectedCategory);
    }

    // Sort: featured first
    result.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    });

    if (limit) {
      result = result.slice(0, limit);
    }

    return result;
  }, [templates, search, selectedCategory, limit]);

  const handleSelect = (template) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleSuccess = (source) => {
    onSourceCreated?.(source);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      {!compact && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
        </div>
      )}

      {/* Category filters */}
      {!compact && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs transition-all ${
              selectedCategory === null
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            All
          </button>
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs transition-all ${
                selectedCategory === cat.id
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Template grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">
          No integrations found
        </div>
      ) : compact ? (
        <div className="space-y-2">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} onSelect={handleSelect} compact />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} onSelect={handleSelect} />
          ))}
        </div>
      )}

      {/* Install dialog */}
      <InstallDialog
        template={selectedTemplate}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default TemplateBrowser;
