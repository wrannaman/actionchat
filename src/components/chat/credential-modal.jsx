"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Key, Shield, Trash2, Plus, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const AUTH_TYPE_CONFIG = {
  bearer: {
    title: "Bearer Token",
    description: "Enter your API bearer token",
    fields: [
      { name: "token", label: "Token", type: "password", placeholder: "Bearer token..." },
    ],
  },
  api_key: {
    title: "API Key",
    description: "Enter your API key",
    fields: [
      { name: "api_key", label: "API Key", type: "password", placeholder: "Your API key..." },
    ],
  },
  basic: {
    title: "Basic Authentication",
    description: "Enter your username and password",
    fields: [
      { name: "username", label: "Username", type: "text", placeholder: "Username..." },
      { name: "password", label: "Password", type: "password", placeholder: "Password..." },
    ],
  },
  header: {
    title: "Custom Header",
    description: "Enter the header name and value",
    fields: [
      { name: "header_name", label: "Header Name", type: "text", placeholder: "X-Custom-Header" },
      { name: "header_value", label: "Header Value", type: "password", placeholder: "Header value..." },
    ],
  },
  passthrough: {
    title: "Passthrough Authentication",
    description: "Your session credentials will be forwarded automatically.",
    fields: [],
  },
  none: {
    title: "No Authentication",
    description: "This API doesn't require authentication.",
    fields: [],
  },
};

// Detect environment from key prefix (Stripe-style)
function detectEnvBadge(maskedPreview) {
  if (!maskedPreview) return null;
  if (maskedPreview.startsWith("sk_t") || maskedPreview.startsWith("rk_t")) {
    return { label: "TEST", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
  }
  if (maskedPreview.startsWith("sk_l") || maskedPreview.startsWith("rk_l")) {
    return { label: "LIVE", color: "bg-green-500/20 text-green-400 border-green-500/30" };
  }
  return null;
}

export function CredentialModal({
  open,
  onOpenChange,
  source,
  onSave,
  onDelete,
}) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [values, setValues] = useState({});
  const [label, setLabel] = useState("");

  const authType = source?.auth_type || "none";
  const config = AUTH_TYPE_CONFIG[authType] || AUTH_TYPE_CONFIG.none;

  useEffect(() => {
    if (open && source?.id) {
      loadCredentials();
    }
  }, [open, source?.id]);

  useEffect(() => {
    if (source) {
      resetForm();
    }
  }, [source?.id, authType]);

  const resetForm = () => {
    const initialValues = {};
    config.fields.forEach((field) => {
      initialValues[field.name] = "";
    });
    setValues(initialValues);
    setLabel("");
    setShowAddForm(false);
  };

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/credentials`);
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials || []);
        // Auto-show form if no credentials
        if (!data.credentials?.length) {
          setShowAddForm(true);
        }
      }
    } catch (err) {
      console.error("Failed to load credentials:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const finalLabel = label.trim() || "Default";

    // Validate required fields
    const missingFields = config.fields.filter((f) => !values[f.name]?.trim());
    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.map((f) => f.label).join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, label: finalLabel }),
      });

      if (res.ok) {
        toast.success(`Saved "${finalLabel}"`);
        await loadCredentials();
        resetForm();
        onSave?.(source.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch (err) {
      toast.error("Failed to save credentials");
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (credId) => {
    try {
      const res = await fetch(`/api/sources/${source.id}/credentials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential_id: credId }),
      });

      if (res.ok) {
        toast.success("Switched credential");
        await loadCredentials();
        onSave?.(source.id);
      }
    } catch (err) {
      toast.error("Failed to switch");
    }
  };

  const handleDelete = async (credId, credLabel) => {
    setDeleting(credId);
    try {
      const res = await fetch(`/api/sources/${source.id}/credentials?credential_id=${credId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(`Removed "${credLabel}"`);
        await loadCredentials();
        onDelete?.(source.id);
      }
    } catch (err) {
      toast.error("Failed to remove");
    } finally {
      setDeleting(null);
    }
  };

  const handleChange = (fieldName, value) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  // No credentials needed
  if (authType === "none" || authType === "passthrough") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#0d0d12] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              {config.title}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {config.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/50">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d0d12] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-cyan-400" />
            {source?.name} — {config.title}
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {credentials.length > 0
              ? "Select active credential or add a new one"
              : config.description}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/50" />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Existing credentials list */}
            {credentials.length > 0 && (
              <div className="space-y-2">
                {credentials.map((cred) => {
                  const envBadge = detectEnvBadge(cred.masked_preview);
                  return (
                    <div
                      key={cred.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        cred.is_active
                          ? "bg-blue-500/10 border-blue-500/30"
                          : "bg-white/[0.02] border-white/10 hover:border-white/20"
                      }`}
                    >
                      <button
                        onClick={() => !cred.is_active && handleSetActive(cred.id)}
                        className="flex-1 flex items-center gap-3 text-left"
                        disabled={cred.is_active}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          cred.is_active ? "border-blue-400 bg-blue-400" : "border-white/30"
                        }`}>
                          {cred.is_active && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{cred.label}</span>
                            {envBadge && (
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${envBadge.color}`}>
                                {envBadge.label}
                              </span>
                            )}
                          </div>
                          {cred.masked_preview && (
                            <code className="text-[11px] text-white/40 font-mono">
                              {cred.masked_preview}
                            </code>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id, cred.label)}
                        disabled={deleting === cred.id}
                        className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        {deleting === cred.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new form */}
            {showAddForm ? (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Label</Label>
                  <Input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Production, Test, Staging..."
                    className="bg-white/5 border-white/10 text-sm"
                  />
                </div>

                {config.fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name} className="text-white/70 text-xs">
                      {field.label}
                    </Label>
                    <Input
                      id={field.name}
                      type={field.type}
                      value={values[field.name] || ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                ))}

                <div className="flex gap-2 pt-2">
                  {credentials.length > 0 && (
                    <Button
                      variant="ghost"
                      onClick={resetForm}
                      className="text-white/50"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-blue-500 hover:bg-blue-400"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowAddForm(true)}
                className="w-full border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Credential
              </Button>
            )}

            <p className="text-[11px] text-white/30">
              Credentials are stored securely and only used for API requests you initiate.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/50">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
