"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Crown, Eye, Pencil, X, UserPlus, Copy, Check, Link2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Shared team member list component
 * Used on /team page and /projects/[id] Team Access tab
 * 
 * Props:
 * - members: array of team members
 * - loading: boolean
 * - isOwner: boolean - can current user manage roles?
 * - projectId: string | null - if set, shows project-specific access controls
 * - inviteUrl: string - invite link to copy
 * - onRoleChange: (memberId, role) => void
 * - onAccessChange: (memberId, accessLevel) => void - for project access
 * - onInvite: (email, accessLevel) => Promise<void> - invite new person
 * - onRefresh: () => void - refresh the list
 */
export function TeamMemberList({
  members = [],
  loading = false,
  isOwner = false,
  projectId = null,
  inviteUrl = "",
  onRoleChange,
  onAccessChange,
  onInvite,
  onRefresh,
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAccess, setInviteAccess] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !onInvite) return;

    setInviting(true);
    try {
      await onInvite(inviteEmail.trim(), projectId ? inviteAccess : null);
      setInviteEmail("");
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Invite failed:", error);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Invite Section - Only for owners */}
      {isOwner && (
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10 dark:bg-zinc-900/50 dark:border-zinc-800">
          <p className="text-sm font-medium mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add team member
          </p>
          <form onSubmit={handleInvite} className="flex gap-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 bg-white/[0.03] border-white/10 dark:bg-zinc-800 dark:border-zinc-700"
            />
            {projectId && (
              <Select value={inviteAccess} onValueChange={setInviteAccess}>
                <SelectTrigger className="w-[120px] bg-white/[0.03] border-white/10 dark:bg-zinc-800 dark:border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-green-500" />
                      Viewer
                    </div>
                  </SelectItem>
                  <SelectItem value="editor">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-3.5 w-3.5 text-blue-500" />
                      Editor
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
            </Button>
          </form>
          
          {/* Copy invite link */}
          {inviteUrl && (
            <div className="mt-3 pt-3 border-t border-white/10 dark:border-zinc-800">
              <p className="text-xs text-muted-foreground mb-2">Or share invite link:</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/[0.02] dark:bg-zinc-800/50 border border-white/10 dark:border-zinc-700 rounded px-3 py-1.5 font-mono text-xs truncate">
                  {inviteUrl}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members List */}
      {members.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No team members yet
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/10 dark:bg-zinc-900/50 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary dark:bg-zinc-800 dark:text-zinc-400 text-sm">
                    {member.name?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {member.name}
                    {member.is_current_user && <span className="text-muted-foreground ml-1">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>

              {/* Access Controls */}
              {member.role === "owner" ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 text-amber-500 text-xs font-medium">
                  <Crown className="h-3 w-3" />
                  Owner
                </div>
              ) : projectId ? (
                // Project-specific access dropdown
                <Select
                  value={member.project_access || "none"}
                  onValueChange={(value) => onAccessChange?.(member.id, value)}
                  disabled={!isOwner}
                >
                  <SelectTrigger className="w-[120px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                        No Access
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5 text-green-500" />
                        Viewer
                      </div>
                    </SelectItem>
                    <SelectItem value="editor">
                      <div className="flex items-center gap-2">
                        <Pencil className="h-3.5 w-3.5 text-blue-500" />
                        Editor
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                // Org-level role dropdown (for team page)
                isOwner && !member.is_current_user ? (
                  <Select
                    value={member.role}
                    onValueChange={(value) => onRoleChange?.(member.id, value)}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">
                        <div className="flex items-center gap-2">
                          <Crown className="h-3.5 w-3.5 text-amber-500" />
                          Owner
                        </div>
                      </SelectItem>
                      <SelectItem value="member">
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-3.5 w-3.5" />
                          Member
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xs text-muted-foreground px-3 py-1">
                    {member.role}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {projectId && members.length > 0 && (
        <div className="pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 inline-flex mr-4">
            <Eye className="h-3 w-3 text-green-500" />
            Viewer: Can see results
          </span>
          <span className="flex items-center gap-1 inline-flex">
            <Pencil className="h-3 w-3 text-blue-500" />
            Editor: Can create & edit evals
          </span>
        </div>
      )}
    </div>
  );
}

