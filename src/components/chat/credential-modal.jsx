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
import { Loader2, Key, Shield, Trash2 } from "lucide-react";
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
    description: "Enter your API key and optional header name",
    fields: [
      { name: "api_key", label: "API Key", type: "password", placeholder: "Your API key..." },
      { name: "header_name", label: "Header Name", type: "text", placeholder: "X-API-Key", defaultValue: "X-API-Key" },
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
    description: "Your session credentials will be forwarded automatically. No additional configuration needed.",
    fields: [],
  },
  none: {
    title: "No Authentication",
    description: "This API doesn't require authentication.",
    fields: [],
  },
};

export function CredentialModal({
  open,
  onOpenChange,
  source,
  onSave,
  onDelete,
}) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [loading, setLoading] = useState(true);

  const authType = source?.auth_type || "none";
  const config = AUTH_TYPE_CONFIG[authType] || AUTH_TYPE_CONFIG.none;

  // Load existing credential status
  useEffect(() => {
    if (open && source?.id) {
      loadCredentialStatus();
    }
  }, [open, source?.id]);

  // Reset form when source changes
  useEffect(() => {
    if (source) {
      const initialValues = {};
      config.fields.forEach((field) => {
        initialValues[field.name] = field.defaultValue || "";
      });
      setValues(initialValues);
    }
  }, [source?.id, authType]);

  const loadCredentialStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/credentials`);
      if (res.ok) {
        const data = await res.json();
        setHasExisting(data.has_credentials);
      }
    } catch (err) {
      console.error("Failed to check credentials:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    const missingFields = config.fields
      .filter((f) => !f.defaultValue) // Fields with defaults are optional
      .filter((f) => !values[f.name]?.trim());

    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.map((f) => f.label).join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        toast.success("Credentials saved");
        onSave?.(source.id);
        onOpenChange(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save credentials");
      }
    } catch (err) {
      toast.error("Failed to save credentials");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/credentials`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Credentials removed");
        onDelete?.(source.id);
        onOpenChange(false);
      } else {
        toast.error("Failed to remove credentials");
      }
    } catch (err) {
      toast.error("Failed to remove credentials");
    } finally {
      setDeleting(false);
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
            {config.description}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/50" />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {hasExisting && (
              <div className="p-3 rounded-lg bg-green-950/30 border border-green-500/30 text-green-300 text-sm">
                ✓ Credentials already configured. Enter new values to update.
              </div>
            )}

            {config.fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name} className="text-white/70">
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

            <p className="text-xs text-white/30">
              Your credentials are stored securely and only used for API requests you initiate.
            </p>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <div>
            {hasExisting && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/50">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-blue-500 hover:bg-blue-400"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasExisting ? (
                "Update"
              ) : (
                "Save Credentials"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
