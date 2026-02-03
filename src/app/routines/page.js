"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Loader2,
  Trash2,
  Edit3,
  Users,
  Clock,
  Hash,
  Search,
} from "lucide-react";
import { toast } from "sonner";

function RoutinesContent() {
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", prompt: "", description: "" });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRoutine, setDeletingRoutine] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRoutines();
  }, []);

  const loadRoutines = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/routines");
      if (res.ok) {
        const data = await res.json();
        setRoutines(data.routines || []);
      }
    } catch (err) {
      console.error("Failed to load routines:", err);
      toast.error("Failed to load routines");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (routine) => {
    setEditingRoutine(routine);
    setEditForm({
      name: routine.name,
      prompt: routine.prompt,
      description: routine.description || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRoutine || !editForm.name.trim() || !editForm.prompt.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/routines/${editingRoutine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          prompt: editForm.prompt.trim(),
          description: editForm.description.trim() || null,
        }),
      });

      if (res.ok) {
        toast.success("Routine updated");
        setEditDialogOpen(false);
        loadRoutines();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update routine");
      }
    } catch (err) {
      toast.error("Failed to update routine");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (routine) => {
    setDeletingRoutine(routine);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRoutine) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/routines/${deletingRoutine.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Routine deleted");
        setDeleteDialogOpen(false);
        setRoutines((prev) => prev.filter((r) => r.id !== deletingRoutine.id));
      } else {
        toast.error("Failed to delete routine");
      }
    } catch (err) {
      toast.error("Failed to delete routine");
    } finally {
      setDeleting(false);
    }
  };

  // Filter routines by search query
  const filteredRoutines = routines.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.prompt.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  });

  // Get current user ID from routines (all routines have created_by)
  // Separate into: MY routines vs OTHERS' shared routines
  // A routine I created shows in "Your Routines" (even if shared)
  // A routine SOMEONE ELSE shared shows in "Shared with Team"
  const myRoutines = filteredRoutines.filter((r) => r.is_mine);
  const sharedByOthers = filteredRoutines.filter((r) => !r.is_mine && r.is_shared);

  const formatDate = (dateStr) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            Routines
          </h1>
          <p className="text-white/50 mt-1">
            Saved workflows that can be reused with /<span className="text-cyan-400">command</span>
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routines..."
            className="bg-white/5 border-white/10 pl-10 text-white placeholder:text-white/30"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-white/30" />
          </div>
        ) : routines.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold">No routines yet</h2>
            <p className="text-white/50 max-w-md mx-auto">
              Routines are created by completing a task in chat, then clicking
              "Save as Routine".
            </p>
          </div>
        ) : filteredRoutines.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            No routines match "{searchQuery}"
          </div>
        ) : (
          <div className="space-y-8">
            {/* My Routines */}
            {myRoutines.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">
                  Your Routines ({myRoutines.length})
                </h2>
                <div className="space-y-2">
                  {myRoutines.map((routine) => (
                    <RoutineCard
                      key={routine.id}
                      routine={routine}
                      onEdit={() => handleEdit(routine)}
                      onDelete={() => handleDeleteClick(routine)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Shared by Others */}
            {sharedByOthers.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Shared by Team ({sharedByOthers.length})
                </h2>
                <div className="space-y-2">
                  {sharedByOthers.map((routine) => (
                    <RoutineCard
                      key={routine.id}
                      routine={routine}
                      onEdit={() => handleEdit(routine)}
                      onDelete={() => handleDeleteClick(routine)}
                      formatDate={formatDate}
                      isShared
                      isReadOnly={!routine.is_mine}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Routine</DialogTitle>
            <DialogDescription className="text-white/50">
              Modify the routine's name, prompt, or description
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="routine-name"
              />
              <p className="text-[10px] text-white/40 mt-1">
                Available as /{editForm.name || "routine-name"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="Short description of what this does"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Prompt</label>
              <textarea
                value={editForm.prompt}
                onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                className="w-full h-40 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm font-mono resize-none focus:outline-none focus:border-cyan-500"
                placeholder="Instructions for the AI..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="border-white/10 text-white/70 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={saving || !editForm.name.trim() || !editForm.prompt.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 text-black"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Routine</DialogTitle>
            <DialogDescription className="text-white/50">
              Are you sure you want to delete "{deletingRoutine?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-white/10 text-white/70 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-400 text-white"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoutineCard({ routine, onEdit, onDelete, formatDate, isShared, isReadOnly }) {
  const paramCount = routine.parameters ? Object.keys(routine.parameters).length : 0;

  return (
    <div className="group p-4 rounded-lg bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Name and badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-cyan-400 font-mono text-sm">/{routine.name}</span>
            {routine.is_shared && routine.is_mine && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400 border border-green-500/30">
                Shared
              </span>
            )}
            {isShared && !routine.is_mine && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Team
              </span>
            )}
          </div>

          {/* Description */}
          {routine.description && (
            <p className="text-white/70 text-sm mb-2">{routine.description}</p>
          )}

          {/* Prompt preview */}
          <p className="text-white/40 text-xs font-mono truncate mb-3">
            {routine.prompt.slice(0, 100)}{routine.prompt.length > 100 ? "..." : ""}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-[11px] text-white/30">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {routine.use_count || 0} uses
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last used: {formatDate(routine.last_used_at)}
            </span>
            {paramCount > 0 && (
              <span className="text-cyan-400/50">
                {paramCount} param{paramCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Actions - only show for own routines */}
        {!isReadOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-2 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
              title="Edit"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-md hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors cursor-pointer"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoutinesPage() {
  return (
    <AuthGuard>
      <RoutinesContent />
    </AuthGuard>
  );
}
