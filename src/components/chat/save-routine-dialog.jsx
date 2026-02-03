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
import { Loader2, Sparkles, Check, Users } from "lucide-react";
import { toast } from "sonner";

/**
 * Dialog for saving a chat session as a reusable routine.
 *
 * Flow:
 * 1. User clicks "Save as Routine" button in chat
 * 2. Dialog opens and immediately starts extracting pattern via LLM
 * 3. User enters a name (pre-filled with suggestion)
 * 4. User optionally shares with team
 * 5. User clicks Save
 */
export function SaveRoutineDialog({
  open,
  onOpenChange,
  chatId,
  onSaved,
}) {
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [extractError, setExtractError] = useState(null);

  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  // Extract pattern when dialog opens
  useEffect(() => {
    if (open && chatId) {
      extractPattern();
    } else {
      // Reset state when closed
      setExtraction(null);
      setExtractError(null);
      setName("");
      setIsShared(false);
    }
  }, [open, chatId]);

  // Pre-fill name from extraction
  useEffect(() => {
    if (extraction?.suggestedName) {
      setName(extraction.suggestedName);
    }
  }, [extraction?.suggestedName]);

  const extractPattern = async () => {
    setExtracting(true);
    setExtractError(null);

    try {
      const res = await fetch("/api/routines/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to extract pattern");
      }

      setExtraction(data.extraction);
    } catch (err) {
      console.error("[SAVE ROUTINE] Extract error:", err);
      setExtractError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !extraction) return;

    setSaving(true);

    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          prompt: extraction.prompt,
          description: extraction.description,
          parameters: extraction.parameters,
          source_chat_id: chatId,
          is_shared: isShared,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save routine");
      }

      toast.success(`Routine "${name}" saved!`);
      onSaved?.(data.routine);
      onOpenChange(false);
    } catch (err) {
      console.error("[SAVE ROUTINE] Save error:", err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !saving && extraction && name.trim()) {
      e.preventDefault();
      handleSave();
    }
  };

  // Count required parameters
  const paramCount = extraction?.parameters
    ? Object.keys(extraction.parameters).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0f] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Save as Routine
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Turn this conversation into a reusable workflow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Extracting state */}
          {extracting && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-white/60 text-sm">
                Analyzing conversation...
              </p>
            </div>
          )}

          {/* Error state */}
          {extractError && (
            <div className="p-4 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-sm">
              {extractError}
            </div>
          )}

          {/* Extracted content */}
          {extraction && !extracting && (
            <>
              {/* Name input */}
              <div className="space-y-2">
                <Label htmlFor="routine-name" className="text-white/70">
                  Routine Name
                </Label>
                <Input
                  id="routine-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., refund-customer"
                  className="bg-white/5 border-white/10 text-white"
                  autoFocus
                />
                <p className="text-[10px] text-white/40">
                  Use a short, descriptive name. Will be available as /{name || "routine-name"}
                </p>
              </div>

              {/* Description preview */}
              {extraction.description && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-white/80">{extraction.description}</p>
                  {paramCount > 0 && (
                    <p className="text-xs text-cyan-400/70 mt-2">
                      {paramCount} parameter{paramCount !== 1 ? "s" : ""}: {Object.keys(extraction.parameters).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* Share checkbox */}
              <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/[0.07] transition-colors">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-white/50" />
                    <span className="text-sm text-white/90">Share with team</span>
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Other team members will be able to use this routine
                  </p>
                </div>
              </label>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-white/10 text-white/70 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save Routine
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
