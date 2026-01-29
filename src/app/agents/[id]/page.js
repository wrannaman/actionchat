"use client";

import { useState, useEffect, use } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ArrowLeft,
  Trash2,
  Bot,
  Database,
  Globe,
  Cpu,
  MessageSquare,
  Plus,
  X,
  Edit,
  Link2,
  Users,
  Shield,
  Eye,
  Code,
  Copy,
  ExternalLink,
  Clock,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "@/components/ui/save-indicator";

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  ollama: "Ollama",
};

function formatRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function AgentDetailContent({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState(null);
  const [linkedSources, setLinkedSources] = useState([]);
  const [availableSources, setAvailableSources] = useState([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [initialEditForm, setInitialEditForm] = useState({});
  const [showLinkSource, setShowLinkSource] = useState(false);
  const [linkingSource, setLinkingSource] = useState(null);
  const [memberAccess, setMemberAccess] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [showGrantAccess, setShowGrantAccess] = useState(false);
  const [grantingMember, setGrantingMember] = useState(null);
  const [embedConfigs, setEmbedConfigs] = useState([]);
  const [showCreateEmbed, setShowCreateEmbed] = useState(false);
  const [creatingEmbed, setCreatingEmbed] = useState(false);
  const [embedName, setEmbedName] = useState("");
  const [embedOrigins, setEmbedOrigins] = useState("");
  const [deletingEmbed, setDeletingEmbed] = useState(null);
  const [embedToDelete, setEmbedToDelete] = useState(null);
  const [editingEmbed, setEditingEmbed] = useState(null);
  const [editEmbedForm, setEditEmbedForm] = useState({ name: "", allowed_origins: "" });
  const [savingEmbed, setSavingEmbed] = useState(false);
  const [recentChats, setRecentChats] = useState([]);

  // Auto-save for agent edit form
  const { status: saveStatus, saveNow } = useAutoSave({
    data: editForm,
    initialData: initialEditForm,
    enabled: editing && Object.keys(editForm).length > 0,
    onSave: async (data) => {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      // Update local agent state silently
      setAgent((prev) => (prev ? { ...prev, ...data } : prev));
    },
  });

  useEffect(() => {
    fetchAgent();
    fetchAccess();
    fetchEmbedConfigs();
    fetchRecentChats();
  }, [id]);

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data.agent);
        setLinkedSources(data.linked_sources || []);
        setAvailableSources(data.available_sources || []);
        const formData = {
          name: data.agent.name,
          description: data.agent.description || "",
          system_prompt: data.agent.system_prompt || "",
          model_provider: data.agent.model_provider,
          model_name: data.agent.model_name,
          temperature: data.agent.temperature,
        };
        setEditForm(formData);
        setInitialEditForm(formData);
      } else if (res.status === 404) {
        toast.error("Agent not found");
        router.push("/agents");
      } else {
        toast.error("Failed to load agent");
      }
    } catch {
      toast.error("Failed to load agent");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Agent deleted");
        router.push("/agents");
      } else {
        toast.error("Failed to delete agent");
      }
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  };

  const handleLinkSource = async (sourceId, permission = "read") => {
    setLinkingSource(sourceId);
    try {
      const res = await fetch(`/api/agents/${id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId, permission }),
      });

      if (res.ok) {
        toast.success("Source linked");
        setShowLinkSource(false);
        fetchAgent();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to link source");
      }
    } catch {
      toast.error("Failed to link source");
    } finally {
      setLinkingSource(null);
    }
  };

  const handleUnlinkSource = async (sourceId) => {
    try {
      const res = await fetch(`/api/agents/${id}/sources`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });

      if (res.ok) {
        toast.success("Source unlinked");
        fetchAgent();
      } else {
        toast.error("Failed to unlink source");
      }
    } catch {
      toast.error("Failed to unlink source");
    }
  };

  const handlePermissionChange = async (sourceId, permission) => {
    await handleLinkSource(sourceId, permission);
  };

  const fetchAccess = async () => {
    try {
      const res = await fetch(`/api/agents/${id}/access`);
      if (res.ok) {
        const data = await res.json();
        setMemberAccess(data.access || []);
        setAvailableMembers(data.available_members || []);
      }
      // 403 is expected for non-admin users — just hide the section
    } catch {
      // silently fail
    }
  };

  const handleGrantAccess = async (memberId, accessLevel = "operator") => {
    setGrantingMember(memberId);
    try {
      const res = await fetch(`/api/agents/${id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, access_level: accessLevel }),
      });
      if (res.ok) {
        toast.success("Access granted");
        setShowGrantAccess(false);
        fetchAccess();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to grant access");
      }
    } catch {
      toast.error("Failed to grant access");
    } finally {
      setGrantingMember(null);
    }
  };

  const handleRevokeAccess = async (memberId) => {
    try {
      const res = await fetch(`/api/agents/${id}/access`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (res.ok) {
        toast.success("Access revoked");
        fetchAccess();
      } else {
        toast.error("Failed to revoke access");
      }
    } catch {
      toast.error("Failed to revoke access");
    }
  };

  const handleAccessLevelChange = async (memberId, accessLevel) => {
    await handleGrantAccess(memberId, accessLevel);
  };

  const fetchEmbedConfigs = async () => {
    try {
      const res = await fetch(`/api/agents/${id}/embed`);
      if (res.ok) {
        const data = await res.json();
        setEmbedConfigs(data.configs || []);
      }
      // 403 expected for non-admin
    } catch {
      // silently fail
    }
  };

  const handleCreateEmbed = async () => {
    setCreatingEmbed(true);
    try {
      const origins = embedOrigins
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      const res = await fetch(`/api/agents/${id}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: embedName || "Default Widget",
          allowed_origins: origins,
        }),
      });

      if (res.ok) {
        toast.success("Embed widget created");
        setShowCreateEmbed(false);
        setEmbedName("");
        setEmbedOrigins("");
        fetchEmbedConfigs();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create widget");
      }
    } catch {
      toast.error("Failed to create widget");
    } finally {
      setCreatingEmbed(false);
    }
  };

  const handleDeleteEmbed = async (configId) => {
    setDeletingEmbed(configId);
    try {
      const res = await fetch(`/api/agents/${id}/embed`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config_id: configId }),
      });

      if (res.ok) {
        toast.success("Widget deleted");
        fetchEmbedConfigs();
      } else {
        toast.error("Failed to delete widget");
      }
    } catch {
      toast.error("Failed to delete widget");
    } finally {
      setDeletingEmbed(null);
    }
  };

  const openEditEmbed = (config) => {
    setEditEmbedForm({
      name: config.name,
      allowed_origins: config.allowed_origins?.join(", ") || "",
    });
    setEditingEmbed(config);
  };

  const handleSaveEmbed = async () => {
    if (!editingEmbed) return;
    setSavingEmbed(true);
    try {
      const origins = editEmbedForm.allowed_origins
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      const res = await fetch(`/api/agents/${id}/embed`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config_id: editingEmbed.id,
          name: editEmbedForm.name,
          allowed_origins: origins,
        }),
      });

      if (res.ok) {
        toast.success("Widget updated");
        setEditingEmbed(null);
        fetchEmbedConfigs();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update widget");
      }
    } catch {
      toast.error("Failed to update widget");
    } finally {
      setSavingEmbed(false);
    }
  };

  const fetchRecentChats = async () => {
    try {
      const res = await fetch(`/api/agents/${id}/chats`);
      if (res.ok) {
        const data = await res.json();
        setRecentChats(data.chats || []);
      }
    } catch {
      // silently fail
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const unlinkedSources = availableSources.filter(
    (s) => !linkedSources.find((ls) => ls.id === s.id)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : !agent ? (
            <div className="text-center py-16">
              <p className="text-white/40">Agent not found</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <Link
                  href="/agents"
                  className="flex items-center gap-1 text-sm text-white/40 hover:text-white mb-4 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Agents
                </Link>

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black">{agent.name}</h1>
                      {agent.description && (
                        <p className="text-white/40 mt-1">
                          {agent.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <Badge
                          variant="outline"
                          className="border-white/10 text-white/40"
                        >
                          <Cpu className="h-3 w-3 mr-1" />
                          {PROVIDER_LABELS[agent.model_provider]} /{" "}
                          {agent.model_name}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-white/10 text-white/40 font-mono"
                        >
                          temp: {agent.temperature}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(!editing)}
                      className="text-white/50 hover:text-white"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDelete(true)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Chat CTA */}
              <Card className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border-blue-500/20 mb-8">
                <CardContent className="py-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">Ready to chat?</h3>
                    <p className="text-white/40 text-sm">
                      {linkedSources.length > 0
                        ? `${linkedSources.length} source${linkedSources.length > 1 ? "s" : ""} linked — start an ops session`
                        : "Link at least one source to enable chat"}
                    </p>
                  </div>
                  <Link href={`/agents/${id}/chat`}>
                    <Button
                      disabled={linkedSources.length === 0}
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold disabled:opacity-50"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start Chat
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Recent Chats */}
              {recentChats.length > 0 && (
                <Card className="bg-white/5 border-white/10 mb-8">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Recent Chats ({recentChats.length})
                        </CardTitle>
                        <CardDescription className="text-white/40">
                          Resume a previous conversation
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recentChats.slice(0, 10).map((chat) => (
                        <Link
                          key={chat.id}
                          href={`/agents/${id}/chat?chat=${chat.id}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <MessageCircle className="h-4 w-4 text-white/20 shrink-0 group-hover:text-blue-400 transition-colors" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {chat.title || "Untitled chat"}
                              </p>
                              <p className="text-xs text-white/30">
                                {chat.message_count} message{chat.message_count !== 1 ? "s" : ""}
                                {" · "}
                                {formatRelativeTime(chat.updated_at || chat.created_at)}
                              </p>
                            </div>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-white/10 group-hover:text-white/40 shrink-0 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Edit Form */}
              {editing && (
                <Card className="bg-white/5 border-white/10 mb-8">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Edit Agent</CardTitle>
                      <SaveIndicator status={saveStatus} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              description: e.target.value,
                            })
                          }
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        value={editForm.system_prompt}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            system_prompt: e.target.value,
                          })
                        }
                        className="bg-white/5 border-white/10 min-h-[100px]"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Select
                          value={editForm.model_provider}
                          onValueChange={(v) =>
                            setEditForm({ ...editForm, model_provider: v })
                          }
                        >
                          <SelectTrigger className="bg-white/5 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic</SelectItem>
                            <SelectItem value="ollama">Ollama</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Model</Label>
                        <Input
                          value={editForm.model_name}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              model_name: e.target.value,
                            })
                          }
                          className="bg-white/5 border-white/10 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Temperature ({editForm.temperature?.toFixed?.(1) || editForm.temperature})
                        </Label>
                        <Slider
                          value={[parseFloat(editForm.temperature) || 0.1]}
                          onValueChange={([v]) =>
                            setEditForm({ ...editForm, temperature: v })
                          }
                          min={0}
                          max={2}
                          step={0.1}
                          className="mt-3"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          saveNow();
                          setEditing(false);
                        }}
                        className="text-white/50"
                      >
                        Done
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Linked Sources */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Linked Sources ({linkedSources.length})
                      </CardTitle>
                      <CardDescription className="text-white/40">
                        API sources this agent can use to execute calls
                      </CardDescription>
                    </div>
                    {unlinkedSources.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowLinkSource(true)}
                        className="border-white/10"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Link Source
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {linkedSources.length === 0 ? (
                    <div className="text-center py-8">
                      <Database className="h-8 w-8 text-white/20 mx-auto mb-3" />
                      <p className="text-white/30 text-sm mb-3">
                        No sources linked yet.
                      </p>
                      {unlinkedSources.length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowLinkSource(true)}
                          className="border-white/10"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Link a Source
                        </Button>
                      ) : (
                        <Link href="/sources/new">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/10"
                          >
                            Create a Source First
                          </Button>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedSources.map((source) => (
                        <div
                          key={source.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
                              <Database className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                              <Link
                                href={`/sources/${source.id}`}
                                className="font-medium text-sm hover:text-blue-400 transition-colors"
                              >
                                {source.name}
                              </Link>
                              {source.base_url && (
                                <p className="text-xs text-white/30 flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {source.base_url}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={source.permission}
                              onValueChange={(v) =>
                                handlePermissionChange(source.id, v)
                              }
                            >
                              <SelectTrigger className="w-[130px] h-8 text-xs bg-white/5 border-white/10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="read">
                                  Read Only (GET)
                                </SelectItem>
                                <SelectItem value="read_write">
                                  Read + Write
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUnlinkSource(source.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Prompt Display (when not editing) */}
              {!editing && agent.system_prompt && (
                <Card className="bg-white/5 border-white/10 mt-8">
                  <CardHeader>
                    <CardTitle className="text-sm text-white/50">
                      System Prompt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm text-white/40 whitespace-pre-wrap font-mono bg-white/[0.02] p-4 rounded-lg">
                      {agent.system_prompt}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Member Access */}
              {(memberAccess.length > 0 || availableMembers.length > 0) && (
                <Card className="bg-white/5 border-white/10 mt-8">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Member Access ({memberAccess.length})
                        </CardTitle>
                        <CardDescription className="text-white/40">
                          Control which members can use this agent. Owners and admins always have access.
                        </CardDescription>
                      </div>
                      {availableMembers.filter(m => !m.has_access).length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowGrantAccess(true)}
                          className="border-white/10"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Grant Access
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {memberAccess.length === 0 ? (
                      <div className="text-center py-6">
                        <Users className="h-8 w-8 text-white/20 mx-auto mb-3" />
                        <p className="text-white/30 text-sm">
                          No member-specific access grants. Only owners/admins can use this agent.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {memberAccess.map((access) => (
                          <div
                            key={access.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400">
                                {access.email?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{access.email}</p>
                                <p className="text-xs text-white/30">
                                  {access.access_level === "operator" ? "Can execute actions" : "View only"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={access.access_level}
                                onValueChange={(v) => handleAccessLevelChange(access.member_id, v)}
                              >
                                <SelectTrigger className="w-[130px] h-8 text-xs bg-white/5 border-white/10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="operator">
                                    <span className="flex items-center gap-1">
                                      <Shield className="h-3 w-3" /> Operator
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="viewer">
                                    <span className="flex items-center gap-1">
                                      <Eye className="h-3 w-3" /> Viewer
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRevokeAccess(access.member_id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Embed Widgets */}
              <Card className="bg-white/5 border-white/10 mt-8">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        Embed Widgets ({embedConfigs.length})
                      </CardTitle>
                      <CardDescription className="text-white/40">
                        Embed this agent as a chat widget on external sites
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCreateEmbed(true)}
                      className="border-white/10"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Widget
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {embedConfigs.length === 0 ? (
                    <div className="text-center py-6">
                      <Code className="h-8 w-8 text-white/20 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">
                        No embed widgets yet. Create one to embed this agent on external sites.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {embedConfigs.map((config) => (
                        <div
                          key={config.id}
                          className="p-4 rounded-lg bg-white/[0.02] border border-white/5 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{config.name}</p>
                              <p className="text-xs text-white/30">
                                Token: {config.embed_token}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={config.is_active
                                  ? "bg-green-500/10 text-green-400 border-green-500/30 text-xs"
                                  : "bg-white/5 text-white/30 border-white/10 text-xs"}
                              >
                                {config.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditEmbed(config)}
                                className="text-white/40 hover:text-white hover:bg-white/5 h-7 w-7 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEmbedToDelete(config)}
                                disabled={deletingEmbed === config.id}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                              >
                                {deletingEmbed === config.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          {config.allowed_origins.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs text-white/30">Origins:</span>
                              {config.allowed_origins.map((origin, i) => (
                                <Badge key={i} variant="outline" className="text-xs border-white/10 text-white/40">
                                  {origin}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <p className="text-xs text-white/40">Standalone page:</p>
                              <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/10">
                                <code className="flex-1 text-xs font-mono text-cyan-400 break-all select-all">
                                  {typeof window !== 'undefined' ? `${window.location.origin}/embed/${config.embed_token}` : `/embed/${config.embed_token}`}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    copyToClipboard(
                                      `${typeof window !== 'undefined' ? window.location.origin : ''}/embed/${config.embed_token}`
                                    )
                                  }
                                  className="shrink-0 h-6 w-6 p-0 text-white/30 hover:text-white"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <a
                                  href={`/embed/${config.embed_token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-white/30 hover:text-white transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-white/40">Embed snippet:</p>
                              <div className="flex items-start gap-2 p-2 rounded bg-white/5 border border-white/10">
                                <code className="flex-1 text-xs font-mono text-blue-400 break-all select-all">
                                  {`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/embed.js" data-token="${config.embed_token}"></script>`}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    copyToClipboard(
                                      `<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/embed.js" data-token="${config.embed_token}"></script>`
                                    )
                                  }
                                  className="shrink-0 h-6 w-6 p-0 text-white/30 hover:text-white"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Create Embed Dialog */}
              <Dialog open={showCreateEmbed} onOpenChange={setShowCreateEmbed}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Embed Widget</DialogTitle>
                    <DialogDescription>
                      Create an embeddable chat widget for this agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Widget Name</Label>
                      <Input
                        value={embedName}
                        onChange={(e) => setEmbedName(e.target.value)}
                        placeholder="e.g. Support Widget"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Allowed Origins</Label>
                      <Input
                        value={embedOrigins}
                        onChange={(e) => setEmbedOrigins(e.target.value)}
                        placeholder="https://example.com, https://app.example.com"
                        className="bg-white/5 border-white/10"
                      />
                      <p className="text-xs text-white/30">
                        Comma-separated list of allowed origins. Leave empty to allow all.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowCreateEmbed(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateEmbed}
                      disabled={creatingEmbed}
                      className="bg-blue-500 hover:bg-blue-400 text-white"
                    >
                      {creatingEmbed ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      Create Widget
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Grant Access Dialog */}
              <Dialog open={showGrantAccess} onOpenChange={setShowGrantAccess}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Grant Agent Access</DialogTitle>
                    <DialogDescription>
                      Choose a member to give access to this agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 py-4">
                    {availableMembers.filter(m => !m.has_access).map((member) => (
                      <div
                        key={member.member_id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">{member.email}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleGrantAccess(member.member_id)}
                          disabled={grantingMember === member.member_id}
                        >
                          {grantingMember === member.member_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Grant"
                          )}
                        </Button>
                      </div>
                    ))}
                    {availableMembers.filter(m => !m.has_access).length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        All members already have access
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Link Source Dialog */}
              <Dialog open={showLinkSource} onOpenChange={setShowLinkSource}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Link a Source</DialogTitle>
                    <DialogDescription>
                      Choose an API source to give this agent access to
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 py-4">
                    {unlinkedSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">{source.name}</p>
                          {source.base_url && (
                            <p className="text-xs text-muted-foreground">
                              {source.base_url}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleLinkSource(source.id)}
                          disabled={linkingSource === source.id}
                        >
                          {linkingSource === source.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Link"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Delete Dialog */}
              <Dialog open={showDelete} onOpenChange={setShowDelete}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Agent</DialogTitle>
                    <DialogDescription>
                      This will permanently delete &quot;{agent.name}&quot; and
                      all its configuration. Chat history referencing this agent
                      will be preserved but the agent will be unlinked.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setShowDelete(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Delete Agent
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Embed Widget Dialog */}
              <Dialog open={!!embedToDelete} onOpenChange={() => setEmbedToDelete(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Embed Widget</DialogTitle>
                    <DialogDescription>
                      This will permanently delete the &quot;{embedToDelete?.name}&quot; widget.
                      Any sites using this embed will stop working.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setEmbedToDelete(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await handleDeleteEmbed(embedToDelete.id);
                        setEmbedToDelete(null);
                      }}
                      disabled={deletingEmbed === embedToDelete?.id}
                    >
                      {deletingEmbed === embedToDelete?.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Delete Widget
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Edit Embed Widget Dialog */}
              <Dialog open={!!editingEmbed} onOpenChange={(open) => !open && setEditingEmbed(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Embed Widget</DialogTitle>
                    <DialogDescription>
                      Update the widget configuration
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Widget Name</Label>
                      <Input
                        value={editEmbedForm.name}
                        onChange={(e) => setEditEmbedForm({ ...editEmbedForm, name: e.target.value })}
                        placeholder="e.g. Support Widget"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Allowed Origins</Label>
                      <Input
                        value={editEmbedForm.allowed_origins}
                        onChange={(e) => setEditEmbedForm({ ...editEmbedForm, allowed_origins: e.target.value })}
                        placeholder="https://example.com, https://app.example.com"
                        className="bg-white/5 border-white/10"
                      />
                      <p className="text-xs text-white/30">
                        Comma-separated list of allowed origins. Leave empty to allow all.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setEditingEmbed(null)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEmbed}
                      disabled={savingEmbed || !editEmbedForm.name?.trim()}
                      className="bg-blue-500 hover:bg-blue-400 text-white"
                    >
                      {savingEmbed ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AgentDetailPage({ params }) {
  return (
    <AuthGuard>
      <AgentDetailContent params={params} />
    </AuthGuard>
  );
}
