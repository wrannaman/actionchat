"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  Plus,
  X,
  LogOut,
  Loader2,
  User,
  Zap,
  Upload,
  Key,
  Check,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ChatMessage } from "@/components/chat/chat-message";
import { CredentialModal } from "@/components/chat/credential-modal";
import { ApiDetailModal } from "@/components/chat/api-detail-modal";

function TargetIcon({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <defs>
        <linearGradient id="targetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#targetGrad)" />
      <circle cx="50" cy="50" r="32" fill="#0a0a0f" />
      <circle cx="50" cy="50" r="22" fill="url(#targetGrad)" />
      <circle cx="50" cy="50" r="10" fill="#0a0a0f" />
      <circle cx="50" cy="50" r="5" fill="#fff" />
    </svg>
  );
}

// API chip component with credential status
function ApiChip({ source, onRemove, onCredentialClick, onDetailClick, hasCredentials }) {
  const needsAuth = source.auth_type && source.auth_type !== "none" && source.auth_type !== "passthrough";
  const showWarning = needsAuth && !hasCredentials;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm transition-colors cursor-pointer hover:bg-white/10 ${
        showWarning
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-white/5 border-white/10"
      }`}
      onClick={() => onDetailClick(source)}
      title="Click to view endpoints"
    >
      <Zap className="w-3 h-3 text-cyan-400" />
      <span className="text-white/80">{source.name}</span>
      <span className="text-white/30 text-xs">
        {source.tool_count || 0} endpoint{(source.tool_count || 0) === 1 ? "" : "s"}
      </span>

      {/* Credential status indicator */}
      {needsAuth && (
        <span
          className={`ml-1 ${
            hasCredentials ? "text-green-400" : "text-yellow-400"
          }`}
          title={hasCredentials ? "Credentials configured" : "Credentials required"}
        >
          {hasCredentials ? (
            <Check className="w-3 h-3" />
          ) : (
            <Key className="w-3 h-3" />
          )}
        </span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(source.id);
        }}
        className="ml-1 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// Chat history sidebar
function ChatSidebar({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  isOpen,
  onToggle,
  loading
}) {
  return (
    <>
      {/* Sidebar */}
      <div className={`${isOpen ? 'w-64' : 'w-0'} shrink-0 border-r border-white/5 bg-[#0a0a0f] transition-all duration-200 overflow-hidden`}>
        <div className="w-64 h-full flex flex-col">
          {/* Header with New Chat + toggle */}
          <div className="p-3 border-b border-white/5 flex items-center gap-2">
            <Button
              onClick={onNewChat}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10"
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
            <button
              onClick={onToggle}
              className="p-2 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">
                No conversations yet
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    chat.id === currentChatId
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white/80"
                  }`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-sm">{chat.title || "New chat"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toggle button when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute left-2 top-16 z-10 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}
    </>
  );
}

// Add API dialog - shows saved APIs + add new
function AddApiDialog({ open, onOpenChange, onAdd, onRemove, activeSources }) {
  const [tab, setTab] = useState("library");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [allSources, setAllSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);

  useEffect(() => {
    if (open) {
      loadAllSources();
    }
  }, [open]);

  const loadAllSources = async () => {
    setLoadingSources(true);
    try {
      const res = await fetch("/api/sources");
      if (res.ok) {
        const data = await res.json();
        setAllSources(data.sources || []);
      }
    } catch (err) {
      console.error("Failed to load sources:", err);
    } finally {
      setLoadingSources(false);
    }
  };

  const activeIds = new Set((activeSources || []).map((s) => s.id));

  const resetNewForm = () => {
    setUrl("");
    setPreview(null);
    setError("");
    setLoading(false);
    setSaving(false);
  };

  const handleClose = () => {
    resetNewForm();
    setTab("library");
    onOpenChange(false);
  };

  const handleToggleSource = async (source, isActive) => {
    if (isActive) {
      try {
        const res = await fetch(`/api/workspace/sources/${source.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          onRemove(source.id);
          toast.success(`Removed ${source.name}`);
        }
      } catch {
        toast.error("Failed to remove API");
      }
    } else {
      try {
        const res = await fetch(`/api/workspace/sources/${source.id}`, {
          method: "PUT",
        });
        if (res.ok) {
          const data = await res.json();
          onAdd(data.source);
          toast.success(`Added ${source.name}`);
        }
      } catch {
        toast.error("Failed to add API");
      }
    }
  };

  const handleFetch = async (overrideUrl = null) => {
    const fetchUrl = overrideUrl || url;
    if (!fetchUrl?.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(fetchUrl.trim());
      if (!res.ok) {
        setError(`Failed to fetch: ${res.status} ${res.statusText}`);
        setLoading(false);
        return;
      }

      const text = await res.text();
      let spec;
      try {
        spec = JSON.parse(text);
      } catch {
        setError("Invalid JSON. Make sure the URL returns an OpenAPI spec.");
        setLoading(false);
        return;
      }

      if (!spec.openapi && !spec.swagger && !spec.paths) {
        setError("Not a valid OpenAPI spec (missing openapi/swagger version or paths)");
        setLoading(false);
        return;
      }

      let toolCount = 0;
      const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
      for (const pathItem of Object.values(spec.paths || {})) {
        for (const method of methods) {
          if (pathItem[method]) toolCount++;
        }
      }

      setPreview({
        name: spec.info?.title || "Untitled API",
        version: spec.info?.version || "?",
        toolCount,
        spec,
      });
    } catch (err) {
      setError(`Failed to fetch: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      try {
        const spec = JSON.parse(text);
        if (!spec.openapi && !spec.swagger && !spec.paths) {
          setError("Not a valid OpenAPI spec");
          return;
        }

        let toolCount = 0;
        const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
        for (const pathItem of Object.values(spec.paths || {})) {
          for (const method of methods) {
            if (pathItem[method]) toolCount++;
          }
        }

        setPreview({
          name: spec.info?.title || file.name.replace(/\.(json|yaml|yml)$/, ""),
          version: spec.info?.version || "?",
          toolCount,
          spec,
        });
        setUrl("");
      } catch {
        setError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!preview?.spec) return;

    setSaving(true);
    try {
      const res = await fetch("/api/workspace/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec_content: preview.spec }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`Added ${data.source.name} with ${data.source.tool_count} endpoints`);
        onAdd(data.source);
        handleClose();
      } else {
        setError(data.error || "Failed to add API");
      }
    } catch {
      setError("Failed to add API");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !preview) {
      e.preventDefault();
      handleFetch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0d0d12] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage APIs</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => { setTab("library"); resetNewForm(); }}
            className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === "library" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
            }`}
          >
            Your APIs
          </button>
          <button
            onClick={() => setTab("new")}
            className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === "new" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
            }`}
          >
            Add New
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {tab === "library" ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loadingSources ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-white/50" />
              </div>
            ) : allSources.length === 0 ? (
              <div className="text-center py-6 space-y-4">
                <p className="text-white/40">No APIs saved yet.</p>

                {/* Quick-add Mock API */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-medium text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        Try Mock API
                      </div>
                      <div className="text-xs text-white/50 mt-1">
                        8 sample endpoints to test with
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const mockUrl = `${window.location.origin}/api/mock/openapi.json`;
                        setTab("new");
                        setUrl(mockUrl);
                        handleFetch(mockUrl);
                      }}
                      size="sm"
                      className="bg-cyan-500 hover:bg-cyan-400 text-white"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="text-white/30 text-sm">or</div>

                <button onClick={() => setTab("new")} className="text-blue-400 hover:text-blue-300">
                  Add your own API
                </button>
              </div>
            ) : (
              allSources.map((source) => {
                const isActive = activeIds.has(source.id);
                return (
                  <div
                    key={source.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isActive ? "bg-blue-500/10 border-blue-500/30" : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{source.name}</div>
                      <div className="text-xs text-white/40">
                        {source.tool_count || 0} endpoint{(source.tool_count || 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleSource(source, isActive)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        isActive ? "bg-blue-500 text-white hover:bg-blue-400" : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      {isActive ? "Active" : "Add"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : !preview ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://api.example.com/openapi.json"
                className="bg-white/5 border-white/10 flex-1"
                autoFocus
              />
              <Button
                onClick={handleFetch}
                disabled={loading || !url?.trim()}
                className="bg-blue-500 hover:bg-blue-400 px-4"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/30">
              <span>or</span>
              <label className="cursor-pointer hover:text-white/50 transition-colors">
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                <span className="flex items-center gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  upload a file
                </span>
              </label>
            </div>

            {/* Quick-add Mock API suggestion */}
            <div className="pt-2 border-t border-white/5">
              <button
                onClick={() => {
                  const mockUrl = `${window.location.origin}/api/mock/openapi.json`;
                  setUrl(mockUrl);
                  handleFetch(mockUrl);
                }}
                className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors text-left"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-white/80">Try our Mock API</span>
                  <span className="text-white/30 text-xs ml-auto">8 endpoints</span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-950/20 border border-green-500/30">
              <div className="font-medium text-white mb-1">{preview.name}</div>
              <div className="text-sm text-white/50">
                Version {preview.version} · {preview.toolCount} endpoint{preview.toolCount === 1 ? "" : "s"} found
              </div>
            </div>

            {preview.toolCount === 0 && (
              <div className="p-3 rounded-lg bg-yellow-950/30 border border-yellow-500/30 text-yellow-300 text-sm">
                No endpoints found. The spec may be empty or use an unsupported format.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={resetNewForm} className="text-white/50">
                Back
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || preview.toolCount === 0}
                className="bg-blue-500 hover:bg-blue-400"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add API"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={handleClose} className="text-white/50">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Settings dialog for API keys
function SettingsDialog({ open, onOpenChange, onSave }) {
  const [provider, setProvider] = useState("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {};
      if (provider === "openai") {
        body.openai_api_key = openaiKey.trim() || null;
        if (openaiBaseUrl.trim()) {
          body.openai_base_url = openaiBaseUrl.trim();
        }
      } else if (provider === "anthropic") {
        body.anthropic_api_key = anthropicKey.trim() || null;
      }

      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        onSave?.(data.has_api_key);
        toast.success("Settings saved");
        onOpenChange(false);
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d0d12] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
            <button
              onClick={() => setProvider("openai")}
              className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                provider === "openai" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
              }`}
            >
              OpenAI
            </button>
            <button
              onClick={() => setProvider("anthropic")}
              className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                provider === "anthropic" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
              }`}
            >
              Anthropic
            </button>
          </div>

          {provider === "openai" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-white/50 block mb-1">API Key</label>
                <Input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div>
                <label className="text-sm text-white/50 block mb-1">
                  Base URL <span className="text-white/30">(optional, for self-hosted)</span>
                </label>
                <Input
                  value={openaiBaseUrl}
                  onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="bg-white/5 border-white/10"
                />
              </div>
              <p className="text-xs text-white/30">
                Works with OpenAI, Azure OpenAI, or any OpenAI-compatible API (Ollama, vLLM, etc.)
              </p>
            </div>
          )}

          {provider === "anthropic" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-white/50 block mb-1">API Key</label>
                <Input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/50">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-500 hover:bg-blue-400">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Chat interface with persistence
function ChatInterface({
  agentId,
  sources,
  onRemoveSource,
  onOpenAddDialog,
  currentChatId,
  setCurrentChatId,
  initialMessages,
  onChatCreated,
  credentialStatus,
  onCredentialClick,
  onApiDetailClick,
}) {
  const messagesEndRef = useRef(null);
  const chatIdRef = useRef(currentChatId);
  const [input, setInput] = useState("");

  // Update ref when prop changes
  useEffect(() => {
    chatIdRef.current = currentChatId;
  }, [currentChatId]);

  const { messages, status, sendMessage, setMessages } = useChat({
    api: "/api/chat",
    id: currentChatId || undefined,
    initialMessages: initialMessages || [],
    onResponse: (response) => {
      // Capture chatId from response header
      const newChatId = response.headers.get("X-Chat-Id");
      if (newChatId && newChatId !== chatIdRef.current) {
        chatIdRef.current = newChatId;
        setCurrentChatId(newChatId);
        onChatCreated?.(newChatId);
      }
    },
    onError: (err) => {
      console.error("[useChat] onError:", err);
      toast.error(err.message || "Chat failed - check your API key in settings");
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(
      { text: input },
      { body: { agentId, chatId: currentChatId } }
    );
    setInput("");
  };

  // Load messages when initialMessages change (switching chats)
  useEffect(() => {
    console.log("[ChatInterface] initialMessages changed:", initialMessages?.length, initialMessages);
    if (initialMessages && initialMessages.length > 0) {
      console.log("[ChatInterface] Calling setMessages with:", initialMessages);
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-2">What would you like to do?</h2>
              <p className="text-white/40">
                {sources.reduce((sum, s) => sum + (s.tool_count || 0), 0)} endpoints available across {sources.length} API{sources.length === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 overflow-x-auto ${
                    message.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-white/5 border border-white/10 text-white/90"
                  }`}
                >
                  <ChatMessage message={message} />
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-white/50" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom bar: API chips + input */}
      <div className="border-t border-white/5 px-4 py-4 shrink-0 bg-[#0a0a0f]">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* API chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {sources.map((source) => (
              <ApiChip
                key={source.id}
                source={source}
                onRemove={onRemoveSource}
                hasCredentials={credentialStatus[source.id]}
                onCredentialClick={onCredentialClick}
                onDetailClick={onApiDetailClick}
              />
            ))}
            <button
              onClick={onOpenAddDialog}
              className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-white/20 rounded-full text-sm text-white/40 hover:text-white/60 hover:border-white/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Add API
            </button>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 bg-white/5 border border-white/10 h-12 text-base px-3 rounded-md text-white placeholder:text-white/30 outline-none focus:border-blue-500"
              autoFocus
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-12 px-4 bg-blue-500 hover:bg-blue-400"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

// Main chat interface
function ChatContent({ initialChatId }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [workspace, setWorkspace] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat state
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [currentChatId, setCurrentChatId] = useState(initialChatId || null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // API key inline setup
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  // Credential management
  const [credentialStatus, setCredentialStatus] = useState({}); // { sourceId: true/false }
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [selectedSourceForCreds, setSelectedSourceForCreds] = useState(null);

  // API detail modal
  const [apiDetailModalOpen, setApiDetailModalOpen] = useState(false);
  const [selectedSourceForDetail, setSelectedSourceForDetail] = useState(null);

  // Load workspace and chats on mount
  useEffect(() => {
    loadWorkspace();
    loadChats();
  }, []);

  // Load specific chat from URL param
  useEffect(() => {
    if (initialChatId && !initialLoadDone) {
      setInitialLoadDone(true);
      loadChat(initialChatId);
    }
  }, [initialChatId, initialLoadDone]);

  const loadWorkspace = async () => {
    try {
      const res = await fetch("/api/workspace");
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data.workspace);
      }
    } catch (err) {
      console.error("Failed to load workspace:", err);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const loadChats = async () => {
    setLoadingChats(true);
    try {
      const res = await fetch("/api/workspace/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadChat = async (chatId) => {
    console.log("[loadChat] Loading chat:", chatId);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/workspace/chats/${chatId}`);
      console.log("[loadChat] Response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[loadChat] Got data:", data);
        console.log("[loadChat] Messages:", data.messages?.length, data.messages);
        setCurrentChatId(chatId);
        setCurrentMessages(data.messages || []);
      } else {
        toast.error("Failed to load chat");
      }
    } catch (err) {
      console.error("Failed to load chat:", err);
      toast.error("Failed to load chat");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setCurrentMessages([]);
    router.push("/chat", { scroll: false });
  };

  const handleSelectChat = (chatId) => {
    if (chatId === currentChatId) return;
    router.push(`/chat/${chatId}`, { scroll: false });
    loadChat(chatId);
  };

  const handleDeleteChat = async (chatId) => {
    try {
      const res = await fetch(`/api/workspace/chats/${chatId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (chatId === currentChatId) {
          handleNewChat();
        }
        toast.success("Chat deleted");
      }
    } catch {
      toast.error("Failed to delete chat");
    }
  };

  const handleChatCreated = useCallback((chatId) => {
    // Update URL and refresh chat list
    router.push(`/chat/${chatId}`, { scroll: false });
    loadChats();
  }, [router]);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openai_api_key: apiKey.trim() }),
      });
      if (res.ok) {
        await loadWorkspace();
        setApiKey("");
        toast.success("API key saved");
      } else {
        toast.error("Failed to save API key");
      }
    } catch {
      toast.error("Failed to save API key");
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveSource = async (sourceId) => {
    try {
      const res = await fetch(`/api/workspace/sources/${sourceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWorkspace((prev) => ({
          ...prev,
          sources: prev.sources.filter((s) => s.id !== sourceId),
        }));
        toast.success("API removed");
      }
    } catch {
      toast.error("Failed to remove API");
    }
  };

  const handleAddSource = (source) => {
    setWorkspace((prev) => ({
      ...prev,
      sources: [...(prev?.sources || []), source],
    }));

    // If source requires auth, prompt for credentials
    const needsAuth = source.auth_type && source.auth_type !== "none" && source.auth_type !== "passthrough";
    if (needsAuth) {
      setSelectedSourceForCreds(source);
      setCredentialModalOpen(true);
    }
  };

  // Load credential status for all sources
  const loadCredentialStatus = useCallback(async (sourcesToCheck) => {
    if (!sourcesToCheck || sourcesToCheck.length === 0) return;

    const statusMap = { ...credentialStatus };

    await Promise.all(
      sourcesToCheck.map(async (source) => {
        // Only check sources that require auth
        if (!source.auth_type || source.auth_type === "none" || source.auth_type === "passthrough") {
          statusMap[source.id] = true; // No auth needed = "has credentials"
          return;
        }

        try {
          const res = await fetch(`/api/sources/${source.id}/credentials`);
          if (res.ok) {
            const data = await res.json();
            statusMap[source.id] = data.has_credentials;
          }
        } catch (err) {
          console.error(`Failed to check credentials for ${source.name}:`, err);
        }
      })
    );

    setCredentialStatus(statusMap);
  }, [credentialStatus]);

  // Load credential status when sources change
  useEffect(() => {
    const sources = workspace?.sources || [];
    if (sources.length > 0) {
      loadCredentialStatus(sources);
    }
  }, [workspace?.sources]);

  const handleCredentialClick = (source) => {
    setSelectedSourceForCreds(source);
    setCredentialModalOpen(true);
  };

  const handleApiDetailClick = (source) => {
    setSelectedSourceForDetail(source);
    setApiDetailModalOpen(true);
  };

  const handleCredentialSave = (sourceId) => {
    setCredentialStatus((prev) => ({ ...prev, [sourceId]: true }));
  };

  const handleCredentialDelete = (sourceId) => {
    setCredentialStatus((prev) => ({ ...prev, [sourceId]: false }));
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loadingWorkspace) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  const sources = workspace?.sources || [];
  const isReady = workspace?.has_api_key && sources.length > 0 && workspace?.agent_id;

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      {/* Header - fixed at top */}
      <header className="border-b border-white/5 px-4 py-3 shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/chat" className="flex items-center gap-2">
              <TargetIcon className="w-6 h-6" />
              <span className="font-bold text-lg">ActionChat</span>
            </Link>
            {currentChatId && (
              <span className="text-white/30 text-sm font-mono">
                {currentChatId.slice(0, 8)}...
              </span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white/50 hover:text-white">
                <User className="w-4 h-4 mr-2" />
                {user?.email?.split("@")[0] || "User"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0d0d12] border-white/10 text-white">
              <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                <Key className="w-4 h-4 mr-2" />
                API Keys
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={handleLogout} className="text-red-400 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <ChatSidebar
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          loading={loadingChats}
        />

        {isReady ? (
          loadingMessages ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ChatInterface
                agentId={workspace.agent_id}
                sources={sources}
                onRemoveSource={handleRemoveSource}
                onOpenAddDialog={() => setAddDialogOpen(true)}
                currentChatId={currentChatId}
                setCurrentChatId={setCurrentChatId}
                initialMessages={currentMessages}
                onChatCreated={handleChatCreated}
                credentialStatus={credentialStatus}
                onCredentialClick={handleCredentialClick}
                onApiDetailClick={handleApiDetailClick}
              />
            </div>
          )
        ) : (
          <main className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto">
              <div className="text-center py-12">
                {!workspace?.has_api_key ? (
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                      <Key className="w-6 h-6 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold">Add your OpenAI API key</h2>
                    <p className="text-white/40 text-sm">
                      Paste your API key to start chatting with your APIs
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="bg-white/5 border-white/10 flex-1"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                      />
                      <Button
                        onClick={handleSaveApiKey}
                        disabled={!apiKey.trim() || savingKey}
                        className="bg-blue-500 hover:bg-blue-400"
                      >
                        {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-white/30">
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/50">
                        Get an API key from OpenAI
                      </a>
                      {" · "}
                      <button onClick={() => setSettingsOpen(true)} className="underline hover:text-white/50">
                        More providers
                      </button>
                    </p>
                  </div>
                ) : sources.length === 0 ? (
                  <div className="space-y-4">
                    <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/20 flex items-center justify-center mb-4">
                      <Zap className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-bold">Add an API</h2>
                    <p className="text-white/40 text-sm">
                      Connect your first API to start chatting
                    </p>
                    <Button onClick={() => setAddDialogOpen(true)} className="bg-blue-500 hover:bg-blue-400">
                      <Plus className="w-4 h-4 mr-2" />
                      Add API
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </main>
        )}
      </div>

      <AddApiDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddSource}
        onRemove={handleRemoveSource}
        activeSources={sources}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={() => loadWorkspace()}
      />

      <CredentialModal
        open={credentialModalOpen}
        onOpenChange={setCredentialModalOpen}
        source={selectedSourceForCreds}
        onSave={handleCredentialSave}
        onDelete={handleCredentialDelete}
      />

      <ApiDetailModal
        open={apiDetailModalOpen}
        onOpenChange={setApiDetailModalOpen}
        source={selectedSourceForDetail}
        hasCredentials={credentialStatus[selectedSourceForDetail?.id]}
        onManageCredentials={() => {
          setSelectedSourceForCreds(selectedSourceForDetail);
          setCredentialModalOpen(true);
        }}
      />
    </div>
  );
}

export default function ChatPage({ initialChatId }) {
  return (
    <AuthGuard>
      <ChatContent initialChatId={initialChatId} />
    </AuthGuard>
  );
}
