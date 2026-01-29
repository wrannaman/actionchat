"use client";

import { useState, useEffect, use } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  RefreshCw,
  Trash2,
  Globe,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  ExternalLink,
  Edit,
  Plus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "@/components/ui/save-indicator";

const RISK_CONFIG = {
  safe: { icon: ShieldCheck, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  moderate: { icon: Shield, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  dangerous: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
};

const METHOD_COLORS = {
  GET: "bg-green-500/10 text-green-400 border-green-500/30",
  POST: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  PUT: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  PATCH: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  DELETE: "bg-red-500/10 text-red-400 border-red-500/30",
  HEAD: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  OPTIONS: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

function SourceDetailContent({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [source, setSource] = useState(null);
  const [tools, setTools] = useState([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", base_url: "", spec_url: "" });
  const [initialEditForm, setInitialEditForm] = useState({});
  const [showAddTool, setShowAddTool] = useState(false);
  const [deletingTool, setDeletingTool] = useState(null);
  const [toolInput, setToolInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractedTool, setExtractedTool] = useState(null);
  const [addingTool, setAddingTool] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [editToolForm, setEditToolForm] = useState({});
  const [savingTool, setSavingTool] = useState(false);

  useEffect(() => {
    fetchSource();
  }, [id]);

  const fetchSource = async () => {
    try {
      const res = await fetch(`/api/sources/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSource(data.source);
        setTools(data.tools || []);
        const formData = {
          name: data.source.name,
          description: data.source.description || "",
          base_url: data.source.base_url || "",
          spec_url: data.source.spec_url || "",
        };
        setEditForm(formData);
        setInitialEditForm(formData);
      } else if (res.status === 404) {
        toast.error("Source not found");
        router.push("/sources");
      } else {
        toast.error("Failed to load source");
      }
    } catch {
      toast.error("Failed to load source");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/sources/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.changed) {
          toast.success(
            `Synced: ${data.inserted} new, ${data.updated} updated, ${data.removed} removed`
          );
        } else {
          toast.info("Spec unchanged, no sync needed");
        }
        fetchSource();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Source deleted");
        router.push("/sources");
      } else {
        toast.error("Failed to delete source");
      }
    } catch {
      toast.error("Failed to delete source");
    } finally {
      setDeleting(false);
    }
  };

  // Auto-save for source edit form
  const { status: saveStatus, saveNow } = useAutoSave({
    data: editForm,
    initialData: initialEditForm,
    enabled: editing && Object.keys(initialEditForm).length > 0,
    onSave: async (data) => {
      const res = await fetch(`/api/sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      // Update local source state
      setSource((prev) => (prev ? { ...prev, ...data } : prev));
      setInitialEditForm(data);
    },
  });

  const handleExtract = async () => {
    if (!toolInput.trim()) {
      toast.error("Paste a cURL command, API docs, or description");
      return;
    }
    setExtracting(true);
    setExtractedTool(null);
    try {
      const res = await fetch(`/api/sources/${id}/tools/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: toolInput }),
      });
      const data = await res.json();
      if (res.ok && data.tool) {
        setExtractedTool(data.tool);
        toast.success("Extracted tool definition");
      } else {
        toast.error(data.error || "Failed to extract tool");
      }
    } catch {
      toast.error("Failed to extract tool");
    } finally {
      setExtracting(false);
    }
  };

  const handleAddTool = async () => {
    if (!extractedTool) return;
    setAddingTool(true);
    try {
      const res = await fetch(`/api/sources/${id}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extractedTool),
      });

      if (res.ok) {
        toast.success("Tool added");
        setShowAddTool(false);
        setToolInput("");
        setExtractedTool(null);
        fetchSource();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add tool");
      }
    } catch {
      toast.error("Failed to add tool");
    } finally {
      setAddingTool(false);
    }
  };

  const handleDeleteTool = async (toolId) => {
    setDeletingTool(toolId);
    try {
      const res = await fetch(`/api/sources/${id}/tools`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_id: toolId }),
      });

      if (res.ok) {
        toast.success("Tool deleted");
        fetchSource();
      } else {
        toast.error("Failed to delete tool");
      }
    } catch {
      toast.error("Failed to delete tool");
    } finally {
      setDeletingTool(null);
    }
  };

  const openEditTool = (tool) => {
    setEditToolForm({
      name: tool.name,
      description: tool.description || "",
      method: tool.method,
      path: tool.path,
      risk_level: tool.risk_level,
      requires_confirmation: tool.requires_confirmation,
    });
    setEditingTool(tool);
  };

  const handleSaveTool = async () => {
    if (!editingTool) return;
    setSavingTool(true);
    try {
      const res = await fetch(`/api/sources/${id}/tools`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_id: editingTool.id,
          ...editToolForm,
        }),
      });

      if (res.ok) {
        toast.success("Tool updated");
        setEditingTool(null);
        fetchSource();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update tool");
      }
    } catch {
      toast.error("Failed to update tool");
    } finally {
      setSavingTool(false);
    }
  };

  const isManual = source?.source_type === "manual";

  const activeTools = tools.filter((t) => t.is_active);
  const inactiveTools = tools.filter((t) => !t.is_active);

  const riskCounts = {
    safe: activeTools.filter((t) => t.risk_level === "safe").length,
    moderate: activeTools.filter((t) => t.risk_level === "moderate").length,
    dangerous: activeTools.filter((t) => t.risk_level === "dangerous").length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : !source ? (
            <div className="text-center py-16">
              <p className="text-white/40">Source not found</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <Link
                  href="/sources"
                  className="flex items-center gap-1 text-sm text-white/40 hover:text-white mb-4 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sources
                </Link>

                <div className="flex items-start justify-between">
                  <div>
                    {editing ? (
                      <div className="space-y-3 mb-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-white/40">Name</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                            className="bg-white/5 border-white/10 text-lg font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-white/40">
                            Description
                          </Label>
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
                        <div className="space-y-1">
                          <Label className="text-xs text-white/40">
                            Base URL
                          </Label>
                          <Input
                            value={editForm.base_url}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                base_url: e.target.value,
                              })
                            }
                            className="bg-white/5 border-white/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-white/40">
                            Spec URL (for remote sync)
                          </Label>
                          <Input
                            value={editForm.spec_url}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                spec_url: e.target.value,
                              })
                            }
                            placeholder="https://api.example.com/openapi.json"
                            className="bg-white/5 border-white/10"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <SaveIndicator status={saveStatus} />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              saveNow();
                              setEditing(false);
                            }}
                            className="border-white/10"
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h1 className="text-3xl font-black mb-2">
                          {source.name}
                        </h1>
                        {source.description && (
                          <p className="text-white/40 mb-3">
                            {source.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-white/30 flex-wrap">
                          {source.base_url && (
                            <span className="flex items-center gap-1">
                              <Globe className="h-3.5 w-3.5" />
                              {source.base_url}
                            </span>
                          )}
                          {source.spec_url && (
                            <span className="flex items-center gap-1">
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="truncate max-w-xs" title={source.spec_url}>
                                Remote spec
                              </span>
                            </span>
                          )}
                          {source.last_synced_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              Last synced{" "}
                              {new Date(
                                source.last_synced_at
                              ).toLocaleString()}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="border-white/10 text-white/40"
                          >
                            {source.auth_type}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>

                  {!editing && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(true)}
                        className="text-white/50 hover:text-white"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {source.has_spec && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSync}
                          disabled={syncing}
                          className="border-white/10"
                        >
                          {syncing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          Re-sync
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowDelete(true)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {Object.entries(riskCounts).map(([level, count]) => {
                  const config = RISK_CONFIG[level];
                  const Icon = config.icon;
                  return (
                    <Card
                      key={level}
                      className={`${config.bg} ${config.border} border`}
                    >
                      <CardContent className="py-4 flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <div>
                          <p className={`text-2xl font-bold ${config.color}`}>
                            {count}
                          </p>
                          <p className="text-xs text-white/40 capitalize">
                            {level} tools
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Tools Table */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Tools ({activeTools.length})
                      </CardTitle>
                      <CardDescription className="text-white/40">
                        {isManual
                          ? "Manually defined API endpoints"
                          : "API endpoints parsed from the OpenAPI spec"}
                      </CardDescription>
                    </div>
                    {isManual && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddTool(true)}
                        className="border-white/10"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Tool
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {activeTools.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-white/30 text-sm mb-3">
                        {isManual
                          ? "No tools defined yet. Add your first API endpoint."
                          : "No tools parsed yet. Upload an OpenAPI spec and sync."}
                      </p>
                      {isManual && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddTool(true)}
                          className="border-white/10"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Tool
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-white/50">Method</TableHead>
                            <TableHead className="text-white/50">Path</TableHead>
                            <TableHead className="text-white/50">Name</TableHead>
                            <TableHead className="text-white/50">Risk</TableHead>
                            <TableHead className="text-white/50 text-center">
                              Confirm
                            </TableHead>
                            {isManual && (
                              <TableHead className="text-white/50 w-10" />
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeTools.map((tool) => {
                            const riskConfig = RISK_CONFIG[tool.risk_level];
                            const RiskIcon = riskConfig.icon;
                            return (
                              <TableRow
                                key={tool.id}
                                className="border-white/5 hover:bg-white/[0.03]"
                              >
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`font-mono text-xs ${METHOD_COLORS[tool.method] || ""}`}
                                  >
                                    {tool.method}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm text-white/60">
                                  {tool.path}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">
                                      {tool.name}
                                    </p>
                                    {tool.description && (
                                      <p className="text-xs text-white/30 line-clamp-1 max-w-xs">
                                        {tool.description}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`flex items-center gap-1 text-xs ${riskConfig.color}`}
                                  >
                                    <RiskIcon className="h-3.5 w-3.5" />
                                    {tool.risk_level}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {tool.requires_confirmation ? (
                                    <Badge
                                      variant="outline"
                                      className="border-red-500/30 text-red-400 text-xs"
                                    >
                                      Y/n
                                    </Badge>
                                  ) : (
                                    <span className="text-white/20 text-xs">
                                      auto
                                    </span>
                                  )}
                                </TableCell>
                                {isManual && (
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openEditTool(tool)}
                                        className="text-white/40 hover:text-white hover:bg-white/5 h-7 w-7 p-0"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteTool(tool.id)}
                                        disabled={deletingTool === tool.id}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                                      >
                                        {deletingTool === tool.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {inactiveTools.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/5">
                      <p className="text-xs text-white/30 mb-2">
                        {inactiveTools.length} inactive{" "}
                        {inactiveTools.length === 1 ? "tool" : "tools"} (removed
                        from spec)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Tool Dialog */}
              <Dialog open={showAddTool} onOpenChange={(open) => {
                setShowAddTool(open);
                if (!open) {
                  setToolInput("");
                  setExtractedTool(null);
                }
              }}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add API Endpoint</DialogTitle>
                    <DialogDescription>
                      Paste a cURL command, API documentation, or describe the endpoint
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <Textarea
                      value={toolInput}
                      onChange={(e) => setToolInput(e.target.value)}
                      placeholder={`Paste anything:\n\ncurl -X POST https://api.stripe.com/v1/refunds \\\n  -d charge=ch_123\n\n— or —\n\nPOST /v1/refunds - Creates a refund for a charge`}
                      className="bg-white/5 border-white/10 font-mono text-sm min-h-[140px]"
                    />

                    {!extractedTool && (
                      <Button
                        onClick={handleExtract}
                        disabled={extracting || !toolInput.trim()}
                        className="w-full bg-blue-500 hover:bg-blue-400 text-white"
                      >
                        {extracting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Extracting...
                          </>
                        ) : (
                          "Extract Tool Definition"
                        )}
                      </Button>
                    )}

                    {extractedTool && (
                      <div className="space-y-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-white/40 uppercase tracking-wide">Preview</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExtractedTool(null)}
                            className="h-6 text-xs text-white/40 hover:text-white"
                          >
                            Edit
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`font-mono text-xs ${METHOD_COLORS[extractedTool.method] || ""}`}
                          >
                            {extractedTool.method}
                          </Badge>
                          <code className="text-sm text-white/70">{extractedTool.path}</code>
                        </div>
                        <div>
                          <p className="font-medium">{extractedTool.name}</p>
                          {extractedTool.description && (
                            <p className="text-sm text-white/40">{extractedTool.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className={`flex items-center gap-1 ${RISK_CONFIG[extractedTool.risk_level]?.color || 'text-white/40'}`}>
                            {(() => {
                              const Icon = RISK_CONFIG[extractedTool.risk_level]?.icon || Shield;
                              return <Icon className="h-3 w-3" />;
                            })()}
                            {extractedTool.risk_level}
                          </span>
                          {extractedTool.requires_confirmation && (
                            <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
                              Requires confirmation
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowAddTool(false)}>
                      Cancel
                    </Button>
                    {extractedTool && (
                      <Button
                        onClick={handleAddTool}
                        disabled={addingTool}
                        className="bg-green-500 hover:bg-green-400 text-white"
                      >
                        {addingTool ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        Add Tool
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Dialog */}
              <Dialog open={showDelete} onOpenChange={setShowDelete}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Source</DialogTitle>
                    <DialogDescription>
                      This will permanently delete &quot;{source.name}&quot; and
                      all {activeTools.length} of its tools. This cannot be
                      undone.
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
                      Delete Source
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Edit Tool Dialog */}
              <Dialog open={!!editingTool} onOpenChange={(open) => !open && setEditingTool(null)}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Tool</DialogTitle>
                    <DialogDescription>
                      Update the tool definition
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editToolForm.name || ""}
                        onChange={(e) => setEditToolForm({ ...editToolForm, name: e.target.value })}
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={editToolForm.description || ""}
                        onChange={(e) => setEditToolForm({ ...editToolForm, description: e.target.value })}
                        className="bg-white/5 border-white/10 min-h-[60px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Method</Label>
                        <Select
                          value={editToolForm.method || "GET"}
                          onValueChange={(v) => setEditToolForm({ ...editToolForm, method: v })}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                            <SelectItem value="HEAD">HEAD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Risk Level</Label>
                        <Select
                          value={editToolForm.risk_level || "safe"}
                          onValueChange={(v) => setEditToolForm({ ...editToolForm, risk_level: v })}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="safe">Safe</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="dangerous">Dangerous</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Path</Label>
                      <Input
                        value={editToolForm.path || ""}
                        onChange={(e) => setEditToolForm({ ...editToolForm, path: e.target.value })}
                        className="bg-white/5 border-white/10 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setEditingTool(null)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveTool}
                      disabled={savingTool || !editToolForm.name?.trim()}
                      className="bg-blue-500 hover:bg-blue-400 text-white"
                    >
                      {savingTool ? (
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

export default function SourceDetailPage({ params }) {
  return (
    <AuthGuard>
      <SourceDetailContent params={params} />
    </AuthGuard>
  );
}
