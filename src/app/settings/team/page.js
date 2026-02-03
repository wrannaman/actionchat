"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Globe, Users, Crown, Check, Copy, UserPlus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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

export default function TeamSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [domainEnabled, setDomainEnabled] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState(null);
  const [userDomain, setUserDomain] = useState(null);
  const [canEditDomain, setCanEditDomain] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);
  const [isBlockedDomain, setIsBlockedDomain] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();

        if (!data.is_owner) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setMembers(data.members || []);
        setInviteUrl(data.invite_url || "");
        setAllowedDomain(data.allowed_domain);
        setUserDomain(data.user_domain);
        setCanEditDomain(data.can_edit);
        setIsOwner(data.is_owner || false);
        setDomainEnabled(!!data.allowed_domain);
        setIsBlockedDomain(data.is_blocked_domain || false);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Failed to load team settings");
      }
    } catch {
      toast.error("Failed to load team settings");
    } finally {
      setLoading(false);
    }
  };

  const handleDomainToggle = async (enabled) => {
    if (!canEditDomain) return;
    setSavingDomain(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-domain", domain: enabled ? userDomain : null }),
      });
      const data = await res.json();
      if (res.ok) {
        setDomainEnabled(enabled);
        setAllowedDomain(enabled ? userDomain : null);
        toast.success(data.message);
      } else {
        toast.error(data.message || "Failed to update setting");
      }
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setSavingDomain(false);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-role", memberId, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.message || "Failed to update role");
      }
    } catch {
      toast.error("Failed to update role");
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setInviteEmail("");
        fetchData();
      } else {
        toast.error(data.message || "Failed to invite");
      }
    } catch {
      toast.error("Failed to invite");
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

  if (accessDenied) {
    return (
      <div className="py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-white/40 mb-4 text-sm">
          Only organization owners can access team management.
        </p>
        <Button variant="outline" onClick={() => router.push("/settings")}>
          Go to Settings
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const ownerMembers = members.filter(m => m.role === "owner");
  const otherMembers = members.filter(m => m.role !== "owner");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-white/50 text-sm mt-1">
          Manage team members and invite new people
        </p>
      </div>

      {/* Invite Section */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Invite Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-2 mb-3">
            <Input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 bg-white/5 border-white/10"
            />
            <Button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
            </Button>
          </form>

          {inviteUrl && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs text-white/40 mb-2">Or share invite link:</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 font-mono text-xs truncate text-white/60">
                  {inviteUrl}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 border-white/10"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owners */}
      {ownerMembers.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-amber-500" />
              Owners ({ownerMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ownerMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-amber-500/10 text-amber-500 text-sm">
                        {member.name?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {member.name}
                        {member.is_current_user && <span className="text-white/40 ml-1">(you)</span>}
                      </p>
                      <p className="text-xs text-white/40">{member.email}</p>
                    </div>
                  </div>
                  {!member.is_current_user && (
                    <Select value={member.role} onValueChange={(value) => handleRoleChange(member.id, value)}>
                      <SelectTrigger className="w-[100px] h-8 text-xs bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Members */}
      {otherMembers.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Members ({otherMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {otherMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-sm bg-white/10">
                        {member.name?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {member.name}
                        {member.is_current_user && <span className="text-white/40 ml-1">(you)</span>}
                      </p>
                      <p className="text-xs text-white/40">{member.email}</p>
                    </div>
                  </div>
                  <Select value={member.role} onValueChange={(value) => handleRoleChange(member.id, value)}>
                    <SelectTrigger className="w-[100px] h-8 text-xs bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain Auto-Join */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Domain Auto-Join
          </CardTitle>
          <CardDescription className="text-white/40">
            Let anyone with a matching email domain join automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isBlockedDomain ? (
            <p className="text-sm text-white/40">
              Domain auto-join is not available for generic email providers.
              Use the invite link above instead.
            </p>
          ) : !canEditDomain ? (
            <p className="text-sm text-white/40">
              Only organization owners can change this setting.
              {allowedDomain && (
                <span className="block mt-2">
                  Currently allowing: <strong className="text-white/60">@{allowedDomain}</strong>
                </span>
              )}
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium text-sm">Auto-join for @{userDomain}</p>
                <p className="text-xs text-white/40">
                  {domainEnabled
                    ? `Anyone with an @${userDomain} email will automatically join`
                    : "Disabled - users need an invite link"}
                </p>
              </div>
              <Switch
                checked={domainEnabled}
                onCheckedChange={handleDomainToggle}
                disabled={savingDomain || !userDomain}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
