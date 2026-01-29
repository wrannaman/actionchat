"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { CircleDot } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <CircleDot className="h-6 w-6 text-primary animate-pulse" />
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
          </div>
          <Link href="/" className="text-xl font-bold text-foreground">
            ActionChat
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="https://blog.actionchat.io" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Blog
          </Link>
          <ModeToggle />
          <Button asChild variant="outline" className="hover:scale-105 transition-transform duration-200">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
