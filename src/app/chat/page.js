"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Loader2,
  Zap,
  Upload,
  Key,
  Check,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Square,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cachedFetch, clearFetchCache } from "@/lib/fetch-cache";
import { ChatMessage } from "@/components/chat/chat-message";
import { useFileUpload } from "@/hooks/use-file-upload";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { CredentialModal } from "@/components/chat/credential-modal";
import { ApiDetailModal } from "@/components/chat/api-detail-modal";
import { TemplateBrowser } from "@/components/templates/template-browser";
import { SlashCommandAutocomplete } from "@/components/chat/slash-command-autocomplete";
import { SaveRoutineDialog } from "@/components/chat/save-routine-dialog";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { useSlashCommands } from "@/hooks/use-slash-commands";

// API chip component with credential status
function ApiChip({ source, onRemove, onCredentialClick, onDetailClick, credentialInfo, isDisabled }) {
  const needsAuth = source.auth_type && source.auth_type !== "none" && source.auth_type !== "passthrough";
  const hasCredentials = credentialInfo?.has;
  const showWarning = needsAuth && !hasCredentials && !isDisabled;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm transition-colors cursor-pointer hover:bg-white/10 ${
        isDisabled
          ? "bg-white/[0.02] border-white/5 opacity-50"
          : showWarning
            ? "bg-yellow-500/10 border-yellow-500/30"
            : "bg-white/5 border-white/10"
      }`}
      onClick={() => onDetailClick(source)}
      title={isDisabled ? "Click to enable" : "Click to view endpoints"}
    >
      <Zap className={`w-3 h-3 ${isDisabled ? "text-white/30" : "text-cyan-400"}`} />
      <span className={isDisabled ? "text-white/40 line-through" : "text-white/80"}>{source.name}</span>
      {!isDisabled && (
        <span className="text-white/30 text-xs">
          {source.tool_count || 0} endpoint{(source.tool_count || 0) === 1 ? "" : "s"}
        </span>
      )}
      {isDisabled && (
        <span className="text-white/30 text-xs">off</span>
      )}

      {/* Credential status indicator */}
      {!isDisabled && needsAuth && (
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
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm text-white outline-none focus:border-cyan-500"
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
                    <Button onClick={() => setTab("catalog")} className="bg-cyan-500 hover:bg-cyan-400 text-black">
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
                          isActive ? "bg-cyan-500/10 border-cyan-500/30" : "bg-white/[0.02] border-white/10"
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
                        className="bg-cyan-500 hover:bg-cyan-400 text-black px-6"
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
                      className="bg-cyan-500 hover:bg-cyan-400 text-black px-8"
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
  disabledSources = new Set(),
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
  // Filter sources for API calls (exclude disabled ones)
  const enabledSources = sources.filter((s) => !disabledSources.has(s.id));
  const messagesEndRef = useRef(null);
  const chatIdRef = useRef(currentChatId);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [attachments, setAttachments] = useState([]); // { id, file, preview, type, uploading?, uploaded?, key?, url? }
  const { upload: uploadFile, uploading: fileUploading } = useFileUpload();

  // Save as Routine dialog
  const [saveRoutineOpen, setSaveRoutineOpen] = useState(false);

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
    tools: slashTools,
    routines: slashRoutines,
    showAutocomplete,
    suggestions,
    selectedIndex,
    handleInputChange,
    handleKeyDown: handleSlashKeyDown,
    selectTool,
    closeAutocomplete,
    refetchRoutines,
    parseCommand,
    isSlashCommand,
  } = useSlashCommands({ agentId });

  // Check if we're showing only routines (no search term)
  const showingRoutinesOnly = suggestions.length > 0 && suggestions.every(s => s._isRoutine);

  // Update ref when prop changes
  useEffect(() => {
    chatIdRef.current = currentChatId;
    // Also update bodyRef immediately
    bodyRef.current = { ...bodyRef.current, chatId: currentChatId };
  }, [currentChatId]);

  // Generate a stable chat key - use currentChatId if resuming, or a new ID for fresh chats
  // Important: This needs to update when currentChatId changes (e.g., loading a saved chat)
  const [chatKey, setChatKey] = useState(currentChatId || `new-${Date.now()}`);

  // Sync chatKey ONLY when loading a SAVED chat (has initialMessages)
  // Don't sync when we just created a new chat during send - that would reset useChat
  useEffect(() => {
    // Only update chatKey when LOADING a saved chat (has messages already)
    if (currentChatId && currentChatId !== chatKey && initialMessages?.length > 0) {
      setChatKey(currentChatId);
    } else if (!currentChatId && !chatKey.startsWith('new-')) {
      // Starting a fresh new chat (user clicked "New Chat")
      setChatKey(`new-${Date.now()}`);
    }
  }, [currentChatId, chatKey, initialMessages]);

  // Body ref for transport - ensures agentId and chatId are always included
  // This is critical for tool approval responses which don't accept per-call body
  const bodyRef = useRef({ agentId, chatId: currentChatId, enabledSourceIds: enabledSources.map(s => s.id) });

  // Keep bodyRef in sync with current values
  useEffect(() => {
    bodyRef.current = { agentId, chatId: currentChatId, enabledSourceIds: enabledSources.map(s => s.id) };
  }, [agentId, currentChatId, enabledSources]);

  // Transport that always includes body params (needed for addToolApprovalResponse)
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/chat",
      body: () => bodyRef.current,
    }),
    []
  );

  const { messages, status, sendMessage, setMessages, addToolApprovalResponse, stop } = useChat({
    transport,
    id: chatKey,
    initialMessages: initialMessages || [],
    // Auto-submit when user approves a tool (clicks Confirm)
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    // Chat is pre-created in handleSubmit, so we don't need to capture it from headers
    onFinish: () => {
      // Nothing to do - chat list is refreshed when chat is created
    },
    onError: (err) => {
      // Don't show error toast for user-initiated cancellation
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        // User cancelled - this is expected, not an error
        return;
      }
      toast.error(err.message || "Chat failed - check your API key in settings");
    },
  });

  // Approval handlers for dangerous tool confirmations
  const handleApprove = (approvalId) => {
    console.log('[APPROVE] Approving tool call:', approvalId);
    console.log('[APPROVE] Current messages:', messages.length);
    addToolApprovalResponse({ id: approvalId, approved: true });
    console.log('[APPROVE] Called addToolApprovalResponse');
  };

  const handleReject = (approvalId) => {
    console.log('[REJECT] Rejecting tool call:', approvalId);
    addToolApprovalResponse({
      id: approvalId,
      approved: false,
      reason: "User rejected the action",
    });
  };

  // Track different loading states for UI
  const isStreaming = status === 'streaming';
  const isSubmitting = status === 'submitted';
  const anyUploading = attachments.some((a) => a.uploading);
  const isLoading = isStreaming || isSubmitting || executing || anyUploading;
  // Can stop when streaming OR when waiting for first chunk (submitted)
  // This allows cancelling slow initial responses
  const canStop = isStreaming || isSubmitting;

  // Track if we've already initiated a stop to prevent duplicate toasts
  const stoppingRef = useRef(false);

  // Reset stopping flag when status changes to ready (stop completed)
  useEffect(() => {
    if (status === 'ready' || status === 'error') {
      stoppingRef.current = false;
    }
  }, [status]);

  // Stop handler with user feedback (debounced via ref)
  const handleStop = useCallback(() => {
    if (!canStop || stoppingRef.current) return;
    stoppingRef.current = true;
    stop();
    toast.info("Generation stopped");
  }, [canStop, stop]);

  // Global Escape key listener - works even when input isn't focused
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === "Escape" && canStop) {
        e.preventDefault();
        handleStop();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [canStop, handleStop]);

  // Handle input change with slash command detection
  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);
    handleInputChange(value);

    // Clear selected routine if user changed the input away from it
    if (selectedRoutine && !value.startsWith(`/${selectedRoutine.name}`)) {
      setSelectedRoutine(null);
    }
  };

  // Handle keyboard events for autocomplete navigation and cancel
  const handleKeyDown = (e) => {
    // Escape key stops generation when streaming/submitted
    if (e.key === "Escape" && canStop) {
      e.preventDefault();
      handleStop();
      return;
    }

    const result = handleSlashKeyDown(e);
    if (result === "handled") return;
    if (result?.type === "select") {
      handleSelectItem(result.tool);
      return;
    }
  };

  // Track selected routine for when user submits
  const [selectedRoutine, setSelectedRoutine] = useState(null);

  // File attachment handlers - uploads to S3 immediately on select
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Create placeholder attachments (show uploading state)
    const placeholders = files.map((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const isImage = file.type.startsWith("image/");

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        isImage,
        preview: isImage ? URL.createObjectURL(file) : null,
        uploading: true,
        uploaded: false,
      };
    });

    setAttachments((prev) => [...prev, ...placeholders]);

    // Upload each file to S3
    for (const placeholder of placeholders) {
      try {
        const result = await uploadFile(placeholder.file);

        // Update attachment with S3 data
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === placeholder.id
              ? {
                  ...att,
                  uploading: false,
                  uploaded: true,
                  key: result.key,
                  url: result.url,
                }
              : att
          )
        );
      } catch (err) {
        console.error("Upload failed:", err);
        toast.error(`Failed to upload ${placeholder.name}`);

        // Remove failed upload
        setAttachments((prev) => {
          const att = prev.find((a) => a.id === placeholder.id);
          if (att?.preview) URL.revokeObjectURL(att.preview);
          return prev.filter((a) => a.id !== placeholder.id);
        });
      }
    }
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      // Revoke object URL to free memory
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  // Handle selecting a tool or routine from autocomplete
  const handleSelectItem = (item) => {
    const result = selectTool(item);

    if (result.type === 'routine') {
      // Routine selected - insert as slash command so user can add context
      setSelectedRoutine(result);
      setInput(`/${result.name} `);
      // Keep focus on input so user can type additional context
    } else {
      // Tool selected - insert the slash command
      setSelectedRoutine(null);
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

  // Pre-create chat if this is a new conversation
  const ensureChatExists = async (messageText) => {
    console.log('[ENSURE CHAT] currentChatId:', currentChatId, 'chatIdRef:', chatIdRef.current);

    // Use ref as source of truth (React state is async)
    if (chatIdRef.current) {
      console.log('[ENSURE CHAT] Already have chat ID:', chatIdRef.current);
      return chatIdRef.current;
    }

    console.log('[ENSURE CHAT] Creating new chat...');

    // Create chat before sending first message
    try {
      const res = await fetch("/api/workspace/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          title: messageText.slice(0, 100),
        }),
      });

      console.log('[ENSURE CHAT] Response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        const newChatId = data.chat?.id;

        console.log('[ENSURE CHAT] Created chat:', newChatId);

        if (!newChatId) {
          console.error('[ENSURE CHAT] No chat ID in response:', data);
          return null;
        }

        // Update refs and state - but NOT chatKey!
        // Changing chatKey would reset useChat and lose the message
        chatIdRef.current = newChatId;
        bodyRef.current = { ...bodyRef.current, chatId: newChatId };
        setCurrentChatId(newChatId);
        // DON'T call setChatKey here - it would reset useChat state

        // Update URL
        window.history.replaceState(null, "", `/chat/${newChatId}`);
        console.log('[ENSURE CHAT] URL updated to:', `/chat/${newChatId}`);

        // Refresh chat list
        onChatCreated?.(newChatId);

        return newChatId;
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('[ENSURE CHAT] Failed:', res.status, errData);
      }
    } catch (err) {
      console.error("[ENSURE CHAT] Error:", err);
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    closeAutocomplete();

    // Determine the message text
    let messageText = input;
    let isRoutineExecution = false;

    // Check if this is a routine execution (user selected from "/" menu)
    if (selectedRoutine && input.startsWith(`/${selectedRoutine.name}`)) {
      const additionalContext = input.slice(`/${selectedRoutine.name}`.length).trim();
      messageText = `Run the "${selectedRoutine.name}" routine:\n\n${selectedRoutine.prompt}`;
      if (additionalContext) {
        messageText += `\n\nAdditional context: ${additionalContext}`;
      }
      isRoutineExecution = true;
    }

    // Check if this is a tool slash command (but NOT if we already handled it as a routine)
    if (!isRoutineExecution && isSlashCommand(input)) {
      const parsed = parseCommand(input);
      if (parsed) {
        await executeSlashCommand(parsed.tool, parsed.params);
        setInput("");
        setSelectedRoutine(null);
        return;
      }
      toast.info("Unknown command, sending as message");
    }

    // Ensure chat exists before sending (creates one if needed)
    const chatId = await ensureChatExists(messageText);
    console.log('[SUBMIT] Using chatId:', chatId);

    if (!chatId) {
      toast.error("Failed to create chat");
      return;
    }

    // Check all attachments are uploaded
    const pendingUploads = attachments.filter((a) => a.uploading);
    if (pendingUploads.length > 0) {
      toast.info("Please wait for uploads to complete");
      return;
    }

    // Build attachments from S3 URLs (already uploaded)
    const uploadedAttachments = attachments
      .filter((a) => a.uploaded && a.url)
      .map((att) => ({
        name: att.name,
        contentType: att.type,
        url: att.url,
        key: att.key,
      }));

    sendMessage(
      {
        text: messageText,
        experimental_attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      },
      { body: { agentId, chatId } }
    );
    setInput("");
    setSelectedRoutine(null);
    // Clear attachments after sending
    attachments.forEach((att) => {
      if (att.preview) URL.revokeObjectURL(att.preview);
    });
    setAttachments([]);
  };

  // Load/clear messages when initialMessages change (switching chats or new chat)
  useEffect(() => {
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
    } else if (initialMessages && initialMessages.length === 0) {
      // New chat - clear messages
      setMessages([]);
      setStoredToolCalls({});
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
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-2">What would you like to do?</h2>
              {enabledSources.length === 0 && sources.length > 0 ? (
                <p className="text-yellow-400/80">
                  All APIs are disabled. Click an API chip to re-enable.
                </p>
              ) : enabledSources.length === 0 ? (
                <p className="text-white/40">
                  No APIs connected yet
                </p>
              ) : (
                <p className="text-white/40 flex items-center justify-center gap-1.5">
                  {enabledSources.map(s => s.name).join(", ")}
                  <Check className="w-4 h-4 text-green-400" />
                </p>
              )}
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
                const mergedToolCalls = message.toolCalls || storedToolCalls[message.id] || null;

                return (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 overflow-x-auto ${
                        message.role === "user"
                          ? "max-w-[75%] bg-cyan-500 text-black"
                          : "max-w-[90%] bg-white/5 border border-white/10 text-white/90"
                      }`}
                    >
                      <ChatMessage
                        message={{
                          ...message,
                          // Merge stored toolCalls (useChat may have stripped them)
                          toolCalls: mergedToolCalls,
                        }}
                        onApprove={handleApprove}
                        onReject={handleReject}
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
                credentialInfo={credentialStatus[source.id]}
                onCredentialClick={onCredentialClick}
                onDetailClick={onApiDetailClick}
                isDisabled={disabledSources.has(source.id)}
              />
            ))}
            <button
              onClick={onOpenAddDialog}
              className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-white/20 rounded-full text-sm text-white/40 hover:text-white/60 hover:border-white/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Add API
            </button>

            {/* Save as Routine button - appears when chat has tool calls */}
            {currentChatId && messages.some(m =>
              m.toolCalls?.length > 0 ||
              storedToolCalls[m.id]?.length > 0 ||
              m.parts?.some(p => p.type === 'dynamic-tool' || p.type?.startsWith('tool-'))
            ) && (
              <button
                onClick={() => setSaveRoutineOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-cyan-500/30 bg-cyan-500/10 rounded-full text-sm text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-colors cursor-pointer ml-auto"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Save as Routine
              </button>
            )}
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
                toolCount={slashTools?.length || 0}
                showingRoutinesOnly={showingRoutinesOnly}
              />
            )}

            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      att.uploading
                        ? "bg-cyan-500/10 border border-cyan-500/30"
                        : att.uploaded
                        ? "bg-green-500/10 border border-green-500/30"
                        : "bg-white/5 border border-white/10"
                    }`}
                  >
                    {att.uploading ? (
                      <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    ) : att.isImage ? (
                      att.preview ? (
                        <img
                          src={att.preview}
                          alt={att.name}
                          className="w-5 h-5 rounded object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-blue-400" />
                      )
                    ) : att.type === "application/pdf" ? (
                      <FileText className="w-4 h-4 text-red-400" />
                    ) : (
                      <FileIcon className="w-4 h-4 text-white/50" />
                    )}
                    <span className="text-white/70 max-w-[150px] truncate">
                      {att.name}
                    </span>
                    <span className="text-white/30 text-xs">
                      {att.uploading
                        ? "uploading..."
                        : att.size < 1024
                        ? `${att.size}B`
                        : att.size < 1024 * 1024
                        ? `${(att.size / 1024).toFixed(1)}KB`
                        : `${(att.size / 1024 / 1024).toFixed(1)}MB`}
                    </span>
                    {att.uploaded && <Check className="w-3.5 h-3.5 text-green-400" />}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      disabled={att.uploading}
                      className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.txt,.json,.csv,.md,.doc,.docx,.xls,.xlsx"
              />

              {/* File attach button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="h-12 px-3 bg-white/5 border border-white/10 rounded-md text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Attach files"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message or /command..."
                disabled={isLoading}
                className="flex-1 bg-white/5 border border-white/10 h-12 text-base px-3 rounded-md text-white placeholder:text-white/30 outline-none focus:border-cyan-500"
                autoFocus
              />
              {canStop ? (
                <Button
                  type="button"
                  onClick={handleStop}
                  className="h-12 px-4 bg-red-500 hover:bg-red-400"
                  title="Stop generating (Esc)"
                >
                  <Square className="w-5 h-5 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="h-12 px-4 bg-cyan-500 hover:bg-cyan-400 text-black"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Save as Routine Dialog */}
      <SaveRoutineDialog
        open={saveRoutineOpen}
        onOpenChange={setSaveRoutineOpen}
        chatId={currentChatId}
        onSaved={() => refetchRoutines()}
      />
    </>
  );
}

// Main chat interface
function ChatContent({ initialChatId }) {
  const router = useRouter();

  const [workspace, setWorkspace] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
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
  const [credentialStatus, setCredentialStatus] = useState({}); // { sourceId: { has: boolean, label?: string, masked?: string } }
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [selectedSourceForCreds, setSelectedSourceForCreds] = useState(null);

  // API detail modal
  const [apiDetailModalOpen, setApiDetailModalOpen] = useState(false);
  const [selectedSourceForDetail, setSelectedSourceForDetail] = useState(null);

  // Disabled sources - persisted to localStorage
  const [disabledSources, setDisabledSources] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('actionchat:disabledSources');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist disabled sources to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('actionchat:disabledSources', JSON.stringify([...disabledSources]));
    } catch {
      // localStorage not available
    }
  }, [disabledSources]);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await fetch("/api/user/org-status");
        if (res.ok) {
          const data = await res.json();
          if (data.show_onboarding_form) {
            setShowOnboarding(true);
          }
        }
      } catch (err) {
        console.error("Failed to check onboarding status:", err);
      } finally {
        setOnboardingChecked(true);
      }
    };
    checkOnboarding();
  }, []);

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

  const handleChatCreated = useCallback(() => {
    // Clear chats cache and refresh list (URL already updated via replaceState)
    clearFetchCache((key) => key.includes("/api/workspace/chats"));
    loadChats();
  }, []);

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
      setCredentialStatus(prev => ({ ...prev, [source.id]: { has: true } }));
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
          statusMap[source.id] = { has: true }; // No auth needed = "has credentials"
          return;
        }

        try {
          const res = await cachedFetch(`/api/sources/${source.id}/credentials`, {}, { ttlMs: 30000 });
          if (res.ok) {
            const data = await res.json();
            const activeCred = data.credentials?.find(c => c.is_active);
            statusMap[source.id] = {
              has: data.has_credentials,
              label: activeCred?.label,
              masked: activeCred?.masked_preview,
            };
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

  const handleToggleSourceEnabled = (sourceId) => {
    setDisabledSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
        toast.success("API enabled");
      } else {
        next.add(sourceId);
        toast.info("API disabled");
      }
      return next;
    });
  };

  const handleCredentialSave = async (sourceId) => {
    clearFetchCache((key) => key.includes(`/api/sources/${sourceId}/credentials`));
    // Refetch to get the label and masked preview
    try {
      const res = await fetch(`/api/sources/${sourceId}/credentials`);
      if (res.ok) {
        const data = await res.json();
        const activeCred = data.credentials?.find(c => c.is_active);
        setCredentialStatus((prev) => ({
          ...prev,
          [sourceId]: {
            has: data.has_credentials,
            label: activeCred?.label,
            masked: activeCred?.masked_preview,
          },
        }));
      }
    } catch (err) {
      // Fallback to just marking as having credentials
      setCredentialStatus((prev) => ({ ...prev, [sourceId]: { has: true } }));
    }
  };

  const handleCredentialDelete = async (sourceId) => {
    clearFetchCache((key) => key.includes(`/api/sources/${sourceId}/credentials`));
    // Refetch to check if any credentials remain
    try {
      const res = await fetch(`/api/sources/${sourceId}/credentials`);
      if (res.ok) {
        const data = await res.json();
        const activeCred = data.credentials?.find(c => c.is_active);
        setCredentialStatus((prev) => ({
          ...prev,
          [sourceId]: {
            has: data.has_credentials,
            label: activeCred?.label,
            masked: activeCred?.masked_preview,
          },
        }));
      }
    } catch (err) {
      setCredentialStatus((prev) => ({ ...prev, [sourceId]: { has: false } }));
    }
  };

  if (loadingWorkspace) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const sources = workspace?.sources || [];
  const isReady = workspace?.has_api_key && sources.length > 0 && workspace?.agent_id;

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      <AuthenticatedNav />

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
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ChatInterface
                agentId={workspace.agent_id}
                sources={sources}
                disabledSources={disabledSources}
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
                      <Key className="w-6 h-6 text-cyan-400" />
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
                        className="bg-cyan-500 hover:bg-cyan-400 text-black"
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
                    <Button onClick={() => setAddDialogOpen(true)} className="bg-cyan-500 hover:bg-cyan-400 text-black">
                      <Plus className="w-4 h-4 mr-2" />
                      Add API
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
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
        credentialInfo={credentialStatus[selectedSourceForDetail?.id]}
        onManageCredentials={() => {
          setSelectedSourceForCreds(selectedSourceForDetail);
          setCredentialModalOpen(true);
        }}
        isEnabled={selectedSourceForDetail ? !disabledSources.has(selectedSourceForDetail.id) : true}
        onToggleEnabled={handleToggleSourceEnabled}
        enabledCount={sources.filter(s => !disabledSources.has(s.id)).length}
      />

      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={() => setShowOnboarding(false)}
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
