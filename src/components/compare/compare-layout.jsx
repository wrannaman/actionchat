"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, GitBranch } from "lucide-react";
import Link from "next/link";

export function TargetIcon({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <defs>
        <linearGradient id="targetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#06b6d4"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#targetGrad)"/>
      <circle cx="50" cy="50" r="32" fill="#0a0a0f"/>
      <circle cx="50" cy="50" r="22" fill="url(#targetGrad)"/>
      <circle cx="50" cy="50" r="10" fill="#0a0a0f"/>
      <circle cx="50" cy="50" r="5" fill="#fff"/>
    </svg>
  );
}

// All comparison pages for cross-linking
const COMPARE_PAGES = [
  { href: "/compare/zapier", label: "vs Zapier" },
  { href: "/compare/retool", label: "vs Retool" },
  { href: "/compare/lindy", label: "vs Lindy" },
  { href: "/compare/openclaw", label: "vs OpenClaw" },
];

export function CompareLayout({ children, currentPage }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#0a0a0f]/80">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <TargetIcon className="w-8 h-8" />
            <span className="text-xl font-black tracking-tight">
              Action<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Chat</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <Link href="/explore" className="hover:text-white transition-colors">Explore</Link>
            <Link href="/compare" className="hover:text-white transition-colors">Compare</Link>
            <Link href="https://github.com/wrannaman/actionchat" target="_blank" className="hover:text-white transition-colors flex items-center gap-1">
              <GitBranch className="w-4 h-4" />
              GitHub
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
                Try ActionChat Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-3">
            <TargetIcon className="w-5 h-5" />
            <span>&copy; {new Date().getFullYear()} ActionChat. MIT License.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/explore" className="hover:text-white/50 transition-colors">Explore</Link>
            <Link href="/compare" className="hover:text-white/50 transition-colors">Compare</Link>
            {currentPage !== "/compare" && COMPARE_PAGES.filter(p => p.href !== currentPage).map((page) => (
              <Link key={page.href} href={page.href} className="hover:text-white/50 transition-colors">
                {page.label}
              </Link>
            ))}
            <Link href="https://github.com/wrannaman/actionchat" target="_blank" className="hover:text-white/50 transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
