"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useAuthStore } from "@/hooks/use-auth";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JoinPage() {
  const { token } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | joining | error
  const [message, setMessage] = useState("");
  const { fetchOrganizations, setCurrentOrganization } = useAuthStore();

  // Get tags from query params: ?tags=tag1,tag2
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").map(t => t.trim()).filter(Boolean) : null;

  useEffect(() => {
    const handleJoin = async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) {
        // Not logged in - store token and redirect to login (preserve tags in URL)
        const redirectUrl = tags ? `/join/${token}?tags=${encodeURIComponent(tags.join(","))}` : `/join/${token}`;
        try {
          localStorage.setItem("pending_join_token", token);
          localStorage.setItem("auth_redirect_to", redirectUrl);
        } catch {
          // localStorage not available
        }
        router.push("/auth/login");
        return;
      }

      // User is logged in, try to join
      setStatus("joining");

      const res = await fetch("/api/team/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, tags }), // Pass tags from URL
      });

      const data = await res.json();

      if (res.ok) {
        // Update client-side auth state to use the new org
        if (data.org_id) {
          setCurrentOrganization({
            org_id: data.org_id,
            org_name: data.org_name,
            name: data.org_name,
          });
          // Refresh the full org list
          fetchOrganizations();
        }
        
        // Clear any stored token
        try {
          localStorage.removeItem("pending_join_token");
        } catch {
          // ignore
        }

        // Auto-redirect to inbox - same link always works
        router.push("/inbox");
        return;
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to join organization");
      }
    };

    if (token) {
      handleJoin();
    }
  }, [token, tags, router, fetchOrganizations, setCurrentOrganization]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4">
        <div className="bg-card border rounded-lg p-8 text-center space-y-4">
          {(status === "loading" || status === "joining") && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <h1 className="text-xl font-semibold">
                {status === "loading" ? "Processing invite..." : "Joining organization..."}
              </h1>
              <p className="text-muted-foreground">Please wait a moment</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <h1 className="text-xl font-semibold">Unable to join</h1>
              <p className="text-muted-foreground">{message}</p>
              <Button variant="outline" onClick={() => router.push("/")} className="mt-4">
                Go Home
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

