"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "@/components/ui/save-indicator";

function ProfileContent() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    avatar_url: null,
    email: "",
  });
  const [initialProfile, setInitialProfile] = useState({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setInitialProfile({ first_name: data.first_name, last_name: data.last_name });
      } else {
        toast.error("Failed to load profile");
      }
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const { status: saveStatus } = useAutoSave({
    data: { first_name: profile.first_name, last_name: profile.last_name },
    initialData: initialProfile,
    enabled: !loading && Object.keys(initialProfile).length > 0,
    onSave: async (data) => {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
    },
  });

  const getInitials = () => {
    const first = profile.first_name || "";
    const last = profile.last_name || "";
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    if (first) return first[0].toUpperCase();
    if (profile.email) return profile.email[0].toUpperCase();
    return "U";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black mb-2">Profile</h1>
            <p className="text-white/40">Manage your account details</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile.avatar_url} alt={profile.first_name || "User"} />
                      <AvatarFallback className="bg-blue-500/20 text-blue-400 text-xl">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Your Profile
                      </CardTitle>
                      <CardDescription className="text-white/40">
                        {profile.email}
                      </CardDescription>
                    </div>
                  </div>
                  <SaveIndicator status={saveStatus} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={profile.first_name}
                        onChange={(e) =>
                          setProfile({ ...profile, first_name: e.target.value })
                        }
                        placeholder="John"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={profile.last_name}
                        onChange={(e) =>
                          setProfile({ ...profile, last_name: e.target.value })
                        }
                        placeholder="Doe"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={profile.email}
                      disabled
                      className="bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-white/30">
                      Email cannot be changed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
