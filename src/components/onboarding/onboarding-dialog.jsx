"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const HEARD_ABOUT_OPTIONS = [
  { value: "twitter", label: "Twitter/X" },
  { value: "google", label: "Google Search" },
  { value: "friend", label: "Friend or Colleague" },
  { value: "producthunt", label: "Product Hunt" },
  { value: "hackernews", label: "Hacker News" },
  { value: "other", label: "Other" },
];

export function OnboardingDialog({ open, onOpenChange, onComplete }) {
  const [heardAbout, setHeardAbout] = useState("");
  const [otherText, setOtherText] = useState("");
  const [mainProblem, setMainProblem] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalHeardAbout = heardAbout === "other" ? otherText : heardAbout;

    if (!finalHeardAbout.trim() || !mainProblem.trim()) {
      toast.error("Please fill in both fields");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heard_about: finalHeardAbout.trim(),
          main_problem: mainProblem.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Thanks for sharing!");
      onComplete?.();
      onOpenChange(false);
    } catch (err) {
      console.error("[ONBOARDING] Submit error:", err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="bg-[#0a0a0f] border-white/10 text-white sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Welcome to ActionChat
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Help us improve by answering two quick questions
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Question 1: How did you hear about us? */}
          <div className="space-y-3">
            <Label className="text-white/90">
              How did you hear about us?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {HEARD_ABOUT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHeardAbout(option.value)}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                    heardAbout === option.value
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white/90"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Other text input */}
            {heardAbout === "other" && (
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Please specify..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50"
                autoFocus
              />
            )}
          </div>

          {/* Question 2: Main problem */}
          <div className="space-y-3">
            <Label className="text-white/90">
              What&apos;s the #1 problem you hope ActionChat solves for you?
            </Label>
            <textarea
              value={mainProblem}
              onChange={(e) => setMainProblem(e.target.value)}
              placeholder="e.g., I want to automate customer refunds without building a custom dashboard..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50 resize-none"
            />
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={saving || !heardAbout || (heardAbout === "other" && !otherText.trim()) || !mainProblem.trim()}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-medium h-11"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            Get Started
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
