"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log to console in development
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-white/40 mb-6">
          An unexpected error occurred. This has been logged and we&apos;ll look into it.
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            variant="outline"
            className="border-white/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Link href="/">
            <Button className="bg-blue-500 hover:bg-blue-400 text-white">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
        {process.env.NODE_ENV === "development" && error?.message && (
          <div className="mt-8 p-4 rounded-lg bg-red-950/30 border border-red-500/20 text-left">
            <p className="text-xs text-red-400 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
