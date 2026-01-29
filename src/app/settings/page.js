"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Key, Server, Check, Eye, EyeOff, Plus, Trash2, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "@/components/ui/save-indicator";

function SettingsContent() {
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [formData, setFormData] = useState({
    org_name: "",
    openai_api_key: "",
    anthropic_api_key: "",
    ollama_base_url: "",
  });
  const [initialFormData, setInitialFormData] = useState({});
  const [keyStatus, setKeyStatus] = useState({
    has_openai_key: false,
    has_anthropic_key: false,
  });
  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false,
  });

  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState(null);
  const [revokingKey, setRevokingKey] = useState(null);
  const [keyToRevoke, setKeyToRevoke] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchApiKeys();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const initial = {
          org_name: data.org_name || "",
          openai_api_key: data.settings?.openai_api_key || "",
          anthropic_api_key: data.settings?.anthropic_api_key || "",
          ollama_base_url: data.settings?.ollama_base_url || "",
        };
        setFormData(initial);
        setInitialFormData(initial);
        setKeyStatus({
          has_openai_key: data.settings?.has_openai_key || false,
          has_anthropic_key: data.settings?.has_anthropic_key || false,
        });
        setCanEdit(data.can_edit);
      } else {
        toast.error("Failed to load settings");
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  // Auto-save with longer debounce for API keys
  const { status: saveStatus } = useAutoSave({
    data: formData,
    initialData: initialFormData,
    enabled: canEdit && !loading && Object.keys(initialFormData).length > 0,
    debounceMs: 1200,
    onSave: async (data) => {
      // Build payload with only changed fields
      const payload = {};
      if (data.org_name !== initialFormData.org_name) {
        payload.org_name = data.org_name;
      }

      const settingsUpdate = {};
      if (data.openai_api_key !== initialFormData.openai_api_key) {
        settingsUpdate.openai_api_key = data.openai_api_key;
      }
      if (data.anthropic_api_key !== initialFormData.anthropic_api_key) {
        settingsUpdate.anthropic_api_key = data.anthropic_api_key;
      }
      if (data.ollama_base_url !== initialFormData.ollama_base_url) {
        settingsUpdate.ollama_base_url = data.ollama_base_url;
      }

      if (Object.keys(settingsUpdate).length > 0) {
        payload.settings = settingsUpdate;
      }

      if (Object.keys(payload).length === 0) return;

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      // Update initial data and key status after successful save
      setInitialFormData(data);
      if (data.openai_api_key) setKeyStatus(prev => ({ ...prev, has_openai_key: true }));
      if (data.anthropic_api_key) setKeyStatus(prev => ({ ...prev, has_anthropic_key: true }));
    },
  });

  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });

      if (res.ok) {
        const data = await res.json();
        setRevealedKey(data.raw_key);
        setShowCreateKey(false);
        setNewKeyName("");
        fetchApiKeys();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create key");
      }
    } catch {
      toast.error("Failed to create key");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId) => {
    setRevokingKey(keyId);
    try {
      const res = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });

      if (res.ok) {
        toast.success("API key revoked");
        fetchApiKeys();
      } else {
        toast.error("Failed to revoke key");
      }
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setRevokingKey(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black mb-2">Settings</h1>
              <p className="text-white/40">
                Configure LLM API keys and organization settings
              </p>
            </div>
            <SaveIndicator status={saveStatus} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Org Name */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input
                      value={formData.org_name}
                      onChange={(e) =>
                        setFormData({ ...formData, org_name: e.target.value })
                      }
                      disabled={!canEdit}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* LLM API Keys */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    LLM API Keys
                  </CardTitle>
                  <CardDescription className="text-white/40">
                    Agents use these keys to call LLM providers. Keys are
                    encrypted and stored securely.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* OpenAI */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        OpenAI API Key
                        {keyStatus.has_openai_key && formData.openai_api_key === initialFormData.openai_api_key && (
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Set
                          </Badge>
                        )}
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setShowKeys((prev) => ({
                            ...prev,
                            openai: !prev.openai,
                          }))
                        }
                        className="text-white/30 hover:text-white h-6 px-2"
                      >
                        {showKeys.openai ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <Input
                      type={showKeys.openai ? "text" : "password"}
                      value={formData.openai_api_key}
                      onChange={(e) =>
                        setFormData({ ...formData, openai_api_key: e.target.value })
                      }
                      placeholder="sk-..."
                      disabled={!canEdit}
                      className="bg-white/5 border-white/10 font-mono text-sm"
                    />
                  </div>

                  {/* Anthropic */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        Anthropic API Key
                        {keyStatus.has_anthropic_key && formData.anthropic_api_key === initialFormData.anthropic_api_key && (
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Set
                          </Badge>
                        )}
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setShowKeys((prev) => ({
                            ...prev,
                            anthropic: !prev.anthropic,
                          }))
                        }
                        className="text-white/30 hover:text-white h-6 px-2"
                      >
                        {showKeys.anthropic ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <Input
                      type={showKeys.anthropic ? "text" : "password"}
                      value={formData.anthropic_api_key}
                      onChange={(e) =>
                        setFormData({ ...formData, anthropic_api_key: e.target.value })
                      }
                      placeholder="sk-ant-..."
                      disabled={!canEdit}
                      className="bg-white/5 border-white/10 font-mono text-sm"
                    />
                  </div>

                  {/* Ollama */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Ollama Base URL
                    </Label>
                    <Input
                      value={formData.ollama_base_url}
                      onChange={(e) =>
                        setFormData({ ...formData, ollama_base_url: e.target.value })
                      }
                      placeholder="http://localhost:11434"
                      disabled={!canEdit}
                      className="bg-white/5 border-white/10 font-mono text-sm"
                    />
                    <p className="text-xs text-white/20">
                      Only needed if using Ollama for local inference
                    </p>
                  </div>
                </CardContent>
              </Card>

              {!canEdit && (
                <p className="text-center text-white/30 text-sm">
                  Only owners and admins can edit settings
                </p>
              )}

              {/* API Keys */}
              {canEdit && (
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Key className="h-5 w-5" />
                          API Keys
                        </CardTitle>
                        <CardDescription className="text-white/40">
                          Programmatic access tokens for external integrations
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCreateKey(true)}
                        className="border-white/10"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create Key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingKeys ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                      </div>
                    ) : apiKeys.length === 0 ? (
                      <div className="text-center py-8">
                        <Key className="h-8 w-8 text-white/10 mx-auto mb-3" />
                        <p className="text-white/30 text-sm">No API keys created yet</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-white/50">Name</TableHead>
                            <TableHead className="text-white/50">Key</TableHead>
                            <TableHead className="text-white/50">Status</TableHead>
                            <TableHead className="text-white/50">Created</TableHead>
                            <TableHead className="text-white/50 w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {apiKeys.map((key) => (
                            <TableRow key={key.id} className="border-white/5 hover:bg-white/[0.03]">
                              <TableCell className="font-medium text-sm">{key.name}</TableCell>
                              <TableCell className="font-mono text-xs text-white/40">{key.key_prefix}</TableCell>
                              <TableCell>
                                {key.is_active ? (
                                  <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-white/30 border-white/10 text-xs">
                                    Revoked
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-white/40">
                                {new Date(key.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {key.is_active && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setKeyToRevoke(key)}
                                    disabled={revokingKey === key.id}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                                  >
                                    {revokingKey === key.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Create Key Dialog */}
              <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create API Key</DialogTitle>
                    <DialogDescription>
                      Create a new key for programmatic access to ActionChat
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Key Name</Label>
                      <Input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g. Production Integration"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowCreateKey(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateKey}
                      disabled={creatingKey || !newKeyName.trim()}
                      className="bg-blue-500 hover:bg-blue-400 text-white"
                    >
                      {creatingKey ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Revealed Key Dialog */}
              <Dialog open={!!revealedKey} onOpenChange={() => setRevealedKey(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      Save Your API Key
                    </DialogTitle>
                    <DialogDescription>
                      This key will only be shown once. Copy it now — you won&apos;t be able to see it again.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                      <code className="flex-1 text-sm font-mono text-green-400 break-all select-all">
                        {revealedKey}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(revealedKey)}
                        className="shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setRevealedKey(null)}>
                      I&apos;ve saved it
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Revoke Key Confirmation Dialog */}
              <Dialog open={!!keyToRevoke} onOpenChange={() => setKeyToRevoke(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Revoke API Key</DialogTitle>
                    <DialogDescription>
                      This will permanently revoke &quot;{keyToRevoke?.name}&quot;.
                      Any integrations using this key will stop working immediately.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setKeyToRevoke(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await handleRevokeKey(keyToRevoke.id);
                        setKeyToRevoke(null);
                      }}
                      disabled={revokingKey === keyToRevoke?.id}
                    >
                      {revokingKey === keyToRevoke?.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Revoke Key
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
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
