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
  Activity,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cachedFetch, clearFetchCache } from "@/lib/fetch-cache";
import { ChatMessage } from "@/components/chat/chat-message";
import { CredentialModal } from "@/components/chat/credential-modal";
import { ApiDetailModal } from "@/components/chat/api-detail-modal";
import { TemplateBrowser } from "@/components/templates/template-browser";
import { ActionsRail } from "@/components/chat/actions-rail";
import { SlashCommandAutocomplete } from "@/components/chat/slash-command-autocomplete";
import { useSlashCommands } from "@/hooks/use-slash-commands";

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
  onRenameChat,
  isOpen,
  onToggle,
  loading
}) {
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingChatId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingChatId]);

  const handleDoubleClick = (chat, e) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title || "New chat");
  };

  const handleRename = async () => {
    if (editingChatId && editTitle.trim()) {
      await onRenameChat(editingChatId, editTitle.trim());
    }
    setEditingChatId(null);
    setEditTitle("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRename();
    } else if (e.key === "Escape") {
      setEditingChatId(null);
      setEditTitle("");
    }
  };

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
                  onClick={() => editingChatId !== chat.id && onSelectChat(chat.id)}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  {editingChatId === chat.id ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={handleKeyDown}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm text-white outline-none focus:border-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="flex-1 truncate text-sm"
                      onDoubleClick={(e) => handleDoubleClick(chat, e)}
                    >
                      {chat.title || "New chat"}
                    </span>
                  )}
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
  const [tab, setTab] = useState("catalog");
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
    setTab("catalog");
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

  const handleSourceCreated = (source) => {
    // Skip credential prompt since creds were just saved during template install
    onAdd(source, { skipCredentialPrompt: true });
    loadAllSources();
    // Close the dialog after successful install
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl">Connect APIs & Integrations</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg shrink-0">
          <button
            onClick={() => setTab("catalog")}
            className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
              tab === "catalog" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
            }`}
          >
            Browse Catalog
          </button>
          <button
            onClick={() => { setTab("library"); resetNewForm(); }}
            className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
              tab === "library" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
            }`}
          >
            Your APIs {allSources.length > 0 && `(${allSources.length})`}
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
              tab === "custom" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
            }`}
          >
            Custom API
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-sm shrink-0">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === "catalog" ? (
            <div className="py-2">
              <TemplateBrowser onSourceCreated={handleSourceCreated} />
            </div>
          ) : tab === "library" ? (
            <div className="space-y-2 py-2">
              {loadingSources ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                </div>
              ) : allSources.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="text-white/30 text-lg">No APIs connected yet</div>
                  <p className="text-white/50 text-sm max-w-md mx-auto">
                    Browse the catalog to add popular integrations like Stripe, GitHub, or Slack.
                    Or add a custom OpenAPI spec.
                  </p>
                  <div className="flex justify-center gap-3 pt-4">
                    <Button onClick={() => setTab("catalog")} className="bg-blue-500 hover:bg-blue-400">
                      Browse Catalog
                    </Button>
                    <Button onClick={() => setTab("custom")} variant="outline" className="border-white/10 hover:bg-white/5">
                      Add Custom API
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-white/50 mb-3">
                    Toggle APIs on/off for this chat session. Active APIs will be available for the AI to use.
                  </p>
                  {allSources.map((source) => {
                    const isActive = activeIds.has(source.id);
                    return (
                      <div
                        key={source.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          isActive ? "bg-blue-500/10 border-blue-500/30" : "bg-white/[0.02] border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">{source.name}</div>
                            <div className="text-xs text-white/40">
                              {source.tool_count || 0} endpoint{(source.tool_count || 0) === 1 ? "" : "s"}
                              {source.source_type === "mcp" && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px]">MCP</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleSource(source, isActive)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-blue-500 text-white hover:bg-blue-400"
                              : "bg-white/10 text-white/70 hover:bg-white/20"
                          }`}
                        >
                          {isActive ? "Active" : "Enable"}
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6 py-4 max-w-lg mx-auto">
              {!preview ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      OpenAPI Spec URL
                    </label>
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
                        onClick={() => handleFetch()}
                        disabled={loading || !url?.trim()}
                        className="bg-blue-500 hover:bg-blue-400 px-6"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 border-t border-white/10" />
                    <span className="text-white/30 text-sm">or</span>
                    <div className="flex-1 border-t border-white/10" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Upload File
                    </label>
                    <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-white/10 rounded-lg hover:border-white/20 hover:bg-white/[0.02] transition-colors cursor-pointer">
                      <input type="file" accept=".json,.yaml,.yml" onChange={handleFileUpload} className="hidden" />
                      <Upload className="w-5 h-5 text-white/40" />
                      <span className="text-white/50">Drop an OpenAPI spec or click to browse</span>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-white/40 mb-3">Quick start:</p>
                    <button
                      onClick={() => {
                        const mockUrl = `${window.location.origin}/api/mock/openapi.json`;
                        setUrl(mockUrl);
                        handleFetch(mockUrl);
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-cyan-400" />
                        <div className="text-left">
                          <div className="font-medium text-white">Try Mock API</div>
                          <div className="text-xs text-white/50">8 sample endpoints to test with</div>
                        </div>
                      </div>
                      <span className="text-cyan-400 text-sm">Add →</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-6 rounded-lg bg-green-950/20 border border-green-500/30 text-center">
                    <div className="text-2xl font-bold text-white mb-1">{preview.name}</div>
                    <div className="text-white/50">
                      Version {preview.version} · {preview.toolCount} endpoint{preview.toolCount === 1 ? "" : "s"} found
                    </div>
                  </div>

                  {preview.toolCount === 0 && (
                    <div className="p-4 rounded-lg bg-yellow-950/30 border border-yellow-500/30 text-yellow-300 text-sm">
                      No endpoints found. The spec may be empty or use an unsupported format.
                    </div>
                  )}

                  <div className="flex justify-center gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={resetNewForm} className="border-white/10 px-6">
                      Back
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving || preview.toolCount === 0}
                      className="bg-blue-500 hover:bg-blue-400 px-8"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Add API
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
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
  const inputRef = useRef(null);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);

  // Store toolCalls data separately from useChat (useChat may strip custom properties)
  // Map of message ID -> toolCalls array
  const [storedToolCalls, setStoredToolCalls] = useState(() => {
    const map = {};
    (initialMessages || []).forEach(msg => {
      if (msg.toolCalls) {
        map[msg.id] = msg.toolCalls;
      }
    });
    return map;
  });

  // Slash command support
  const {
    showAutocomplete,
    suggestions,
    selectedIndex,
    handleInputChange,
    handleKeyDown: handleSlashKeyDown,
    selectTool,
    closeAutocomplete,
    parseCommand,
    isSlashCommand,
  } = useSlashCommands({ agentId });

  // Update ref when prop changes
  useEffect(() => {
    chatIdRef.current = currentChatId;
  }, [currentChatId]);

  // Track pending chat ID to apply after stream finishes
  const pendingChatIdRef = useRef(null);

  // Generate a stable chat key - use currentChatId if resuming, or a new ID for fresh chats
  // Important: This needs to update when currentChatId changes (e.g., loading a saved chat)
  const [chatKey, setChatKey] = useState(currentChatId || `new-${Date.now()}`);

  // Sync chatKey when currentChatId changes (e.g., navigating to a saved chat)
  useEffect(() => {
    console.log('[CHAT KEY] currentChatId:', currentChatId, 'chatKey:', chatKey, 'initialMessages:', initialMessages?.length);

    if (currentChatId && currentChatId !== chatKey) {
      console.log('[CHAT KEY] Updating chatKey to:', currentChatId);
      setChatKey(currentChatId);
    } else if (!currentChatId && !chatKey.startsWith('new-')) {
      // Starting a new chat
      console.log('[CHAT KEY] Starting new chat');
      setChatKey(`new-${Date.now()}`);
    }
  }, [currentChatId, chatKey, initialMessages]);

  const { messages, status, sendMessage, setMessages } = useChat({
    api: "/api/chat",
    id: chatKey,
    initialMessages: initialMessages || [],
    onResponse: async (response) => {
      // Capture chatId from response header
      const newChatId = response.headers.get("X-Chat-Id");
      if (newChatId && newChatId !== chatIdRef.current) {
        pendingChatIdRef.current = newChatId;
      }
    },
    onFinish: () => {
      // Apply pending chat ID after stream is complete
      if (pendingChatIdRef.current) {
        const newId = pendingChatIdRef.current;
        chatIdRef.current = newId;
        setCurrentChatId(newId);
        setChatKey(newId); // Update the chat key to match the new chat
        onChatCreated?.(newId);
        pendingChatIdRef.current = null;
      }
    },
    onError: (err) => {
      toast.error(err.message || "Chat failed - check your API key in settings");
    },
  });



  const isLoading = status === 'streaming' || status === 'submitted' || executing;

  // Handle input change with slash command detection
  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);
    handleInputChange(value);
  };

  // Handle keyboard events for autocomplete navigation
  const handleKeyDown = (e) => {
    const result = handleSlashKeyDown(e);
    if (result === "handled") return;
    if (result?.type === "select") {
      handleSelectItem(result.tool);
      return;
    }
  };

  // Handle selecting a tool or routine from autocomplete
  const handleSelectItem = (item) => {
    const result = selectTool(item);

    if (result.type === 'routine') {
      // Routine selected - insert the prompt directly
      setInput(result.prompt);
      toast.success(`Routine "${result.name}" loaded`);
    } else {
      // Tool selected - insert the slash command
      setInput(result.command);
    }
  };

  // Execute a slash command directly
  const executeSlashCommand = async (tool, params) => {
    setExecuting(true);
    try {
      const res = await fetch("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: tool.id,
          params,
          agentId,
        }),
      });

      const data = await res.json();

      if (data.requiresConfirmation) {
        // Add a message showing the pending confirmation
        toast.info("Action requires confirmation");
        // For now, send as regular message so AI can handle confirmation
        sendMessage(
          { text: input },
          { body: { agentId, chatId: currentChatId } }
        );
      } else if (data.ok) {
        // Show result as a message
        const resultText = data.result?.error
          ? `Error: ${data.result.error}`
          : `Executed ${tool.name}: ${JSON.stringify(data.result?.body || {}, null, 2)}`;
        toast.success("Command executed");
        // Send as regular message for history
        sendMessage(
          { text: input },
          { body: { agentId, chatId: currentChatId } }
        );
      } else {
        toast.error(data.error || "Failed to execute command");
      }
    } catch (err) {
      toast.error(err.message || "Failed to execute command");
    } finally {
      setExecuting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    closeAutocomplete();

    // Check if this is a slash command
    if (isSlashCommand(input)) {
      const parsed = parseCommand(input);
      if (parsed) {
        // Execute directly via API
        await executeSlashCommand(parsed.tool, parsed.params);
        setInput("");
        return;
      }
      // If command not found, send as regular message
      toast.info("Unknown command, sending as message");
    }

    sendMessage(
      { text: input },
      { body: { agentId, chatId: currentChatId } }
    );
    setInput("");
  };

  // Load messages when initialMessages change (switching chats)
  useEffect(() => {
    console.log('[SET MESSAGES] ════════════════════════════════════════');
    console.log('[SET MESSAGES] initialMessages:', JSON.stringify(initialMessages, null, 2));
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);

      // Update stored tool calls map
      const map = {};
      initialMessages.forEach(msg => {
        if (msg.toolCalls) {
          map[msg.id] = msg.toolCalls;
        }
      });
      setStoredToolCalls(map);
      console.log('[SET MESSAGES] storedToolCalls map:', JSON.stringify(map, null, 2));
    }
    console.log('[SET MESSAGES] ════════════════════════════════════════');
  }, [initialMessages, setMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-2">What would you like to do?</h2>
              <p className="text-white/40">
                {sources.reduce((sum, s) => sum + (s.tool_count || 0), 0)} endpoints available across {sources.length} API{sources.length === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
            messages
              .filter((message) => {
                // Filter out empty messages (assistant with no parts yet)
                const parts = message.parts || [];
                if (message.role === 'assistant' && parts.length === 0) {
                  return false;
                }
                // Filter out assistant messages with only empty text parts
                if (message.role === 'assistant') {
                  const hasContent = parts.some(p =>
                    (p.type === 'text' && p.text?.trim()) ||
                    p.type?.startsWith('tool-') ||
                    p.type === 'dynamic-tool'
                  );
                  return hasContent;
                }
                return true;
              })
              .map((message) => {
                // DEBUG: Log what we're passing to ChatMessage
                const mergedToolCalls = message.toolCalls || storedToolCalls[message.id] || null;
                if (message.role === 'assistant') {
                  console.log('[RENDER] ════════════════════════════════════════');
                  console.log('[RENDER] message.id:', message.id);
                  console.log('[RENDER] message.toolCalls:', JSON.stringify(message.toolCalls, null, 2));
                  console.log('[RENDER] storedToolCalls[id]:', JSON.stringify(storedToolCalls[message.id], null, 2));
                  console.log('[RENDER] mergedToolCalls:', JSON.stringify(mergedToolCalls, null, 2));
                  console.log('[RENDER] ════════════════════════════════════════');
                }

                return (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 overflow-x-auto ${
                        message.role === "user"
                          ? "max-w-[75%] bg-blue-500 text-white"
                          : "max-w-[90%] bg-white/5 border border-white/10 text-white/90"
                      }`}
                    >
                      <ChatMessage
                        message={{
                          ...message,
                          // Merge stored toolCalls (useChat may have stripped them)
                          toolCalls: mergedToolCalls,
                        }}
                      />
                    </div>
                  </div>
                );
              })
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
        <div className="max-w-5xl mx-auto space-y-3">
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

          {/* Input with slash command autocomplete */}
          <div className="relative">
            {/* Autocomplete dropdown */}
            {showAutocomplete && (
              <SlashCommandAutocomplete
                suggestions={suggestions}
                selectedIndex={selectedIndex}
                onSelect={(item) => {
                  handleSelectItem(item);
                  inputRef.current?.focus();
                }}
                onHover={() => {}}
              />
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message or /command..."
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [actionsRailOpen, setActionsRailOpen] = useState(false);

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
      const res = await cachedFetch("/api/workspace", {}, { ttlMs: 30000 });
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
      const res = await cachedFetch("/api/workspace/chats", {}, { ttlMs: 5000 });
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
    setLoadingMessages(true);
    try {
      const res = await cachedFetch(`/api/workspace/chats/${chatId}`, {}, { ttlMs: 5000 });
      if (res.ok) {
        const data = await res.json();
        console.log('[LOAD CHAT CLIENT] ════════════════════════════════════════');
        console.log('[LOAD CHAT CLIENT] Full response:', JSON.stringify(data, null, 2));
        console.log('[LOAD CHAT CLIENT] ════════════════════════════════════════');
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
    // Use replaceState to update URL without causing a full page navigation
    // (router.push to /chat from /chat/[id] causes a full remount)
    window.history.replaceState(null, "", "/chat");
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
        clearFetchCache((key) => key.includes("/api/workspace/chats"));
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

  const handleRenameChat = async (chatId, newTitle) => {
    try {
      const res = await fetch(`/api/workspace/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        clearFetchCache((key) => key.includes("/api/workspace/chats"));
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
        );
        toast.success("Chat renamed");
      } else {
        toast.error("Failed to rename chat");
      }
    } catch {
      toast.error("Failed to rename chat");
    }
  };

  const handleChatCreated = useCallback((chatId) => {
    // Clear chats cache before refreshing list
    clearFetchCache((key) => key.includes("/api/workspace/chats"));
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
        clearFetchCache((key) => key.includes("/api/workspace"));
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
        clearFetchCache((key) => key.includes("/api/workspace") || key.includes("/api/sources"));
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

  const handleAddSource = (source, { skipCredentialPrompt = false } = {}) => {
    clearFetchCache((key) => key.includes("/api/workspace") || key.includes("/api/sources"));
    setWorkspace((prev) => ({
      ...prev,
      sources: [...(prev?.sources || []), source],
    }));

    // If source requires auth and we didn't just save credentials, prompt
    const needsAuth = source.auth_type && source.auth_type !== "none" && source.auth_type !== "passthrough";
    if (needsAuth && !skipCredentialPrompt) {
      setSelectedSourceForCreds(source);
      setCredentialModalOpen(true);
    }

    // Mark as having credentials if we skipped the prompt (means creds were just saved)
    if (skipCredentialPrompt) {
      setCredentialStatus(prev => ({ ...prev, [source.id]: true }));
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
          const res = await cachedFetch(`/api/sources/${source.id}/credentials`, {}, { ttlMs: 30000 });
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
    clearFetchCache((key) => key.includes(`/api/sources/${sourceId}/credentials`));
    setCredentialStatus((prev) => ({ ...prev, [sourceId]: true }));
  };

  const handleCredentialDelete = (sourceId) => {
    clearFetchCache((key) => key.includes(`/api/sources/${sourceId}/credentials`));
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

          <div className="flex items-center gap-2">
            {isReady && (
              <button
                onClick={() => setActionsRailOpen(!actionsRailOpen)}
                className={`p-2 rounded-md transition-colors cursor-pointer ${
                  actionsRailOpen
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "hover:bg-white/10 text-white/40 hover:text-white/70"
                }`}
                title="Recent Actions"
              >
                <Activity className="w-4 h-4" />
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/50 hover:text-white">
                  <User className="w-4 h-4 mr-2" />
                  {user?.email?.split("@")[0] || "User"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#0d0d12] border-white/10 text-white">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings">
                    <Key className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleLogout} className="text-red-400 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
          onRenameChat={handleRenameChat}
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
            <>
              <div className="flex-1 flex flex-col overflow-hidden">
                <ChatInterface
                  key={currentChatId || 'new'}
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
              <ActionsRail
                agentId={workspace.agent_id}
                isOpen={actionsRailOpen}
                onToggle={() => setActionsRailOpen(!actionsRailOpen)}
              />
            </>
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
                      <Link href="/settings" className="underline hover:text-white/50">
                        More providers
                      </Link>
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
