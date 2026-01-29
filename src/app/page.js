"use client";

import { Button } from "@/components/ui/button";
import { PublicOnly } from "@/components/auth-guard";
import { ArrowRight, X, GitBranch, Check, Shield, Server, Users } from "lucide-react";
import Link from "next/link";

function TargetIcon({ className }) {
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

function TerminalDemo() {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
      <div className="relative bg-[#0d0d12] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs text-white/40 font-mono">actionchat</span>
        </div>
        <div className="p-6 font-mono text-sm space-y-4">
          <div>
            <span className="text-white/40">User:</span>
            <span className="text-white ml-2">&quot;Refund the last order for bob@example.com&quot;</span>
          </div>
          <div>
            <span className="text-white/40">ActionChat:</span>
            <span className="text-white/70 ml-2">&quot;Found Order #992. Refund $50? [Y/n]&quot;</span>
          </div>
          <div>
            <span className="text-white/40">User:</span>
            <span className="text-white ml-2">&quot;Y&quot;</span>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <Check className="w-4 h-4" />
            <span className="font-mono">POST /refunds/992 — 200 OK</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemItem({ children }) {
  return (
    <div className="flex items-start gap-3">
      <X className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <span className="text-white/70">{children}</span>
    </div>
  );
}

function FeatureItem({ children }) {
  return (
    <div className="flex items-start gap-3">
      <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
      <span className="text-white/70">{children}</span>
    </div>
  );
}

function HomeContent() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden relative">
      {/* Subtle background */}
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
          <div className="flex items-center gap-4">
            <Link href="https://github.com/actionchat/actionchat" target="_blank" className="text-white/50 hover:text-white transition-colors">
              <GitBranch className="w-5 h-5" />
            </Link>
            <Link href="/auth/login">
              <Button className="bg-white/10 hover:bg-white/15 text-white border border-white/10">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="container mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-[1.1]">
              The API <em className="not-italic text-cyan-400">is</em> the Admin Panel.
            </h1>

            <p className="text-xl text-white/60 mb-4 max-w-2xl mx-auto">
              <strong className="text-white">Stop building internal tools.</strong> ActionChat turns your{" "}
              <code className="px-2 py-1 bg-white/5 rounded text-cyan-400 font-mono">openapi.json</code> into 
              a secure, authenticated Ops Dashboard in 30 seconds.
            </p>

            <p className="text-lg text-white/40 mb-8 max-w-xl mx-auto">
              Not another support bot that links to outdated KB articles. This actually <em>does</em> the thing.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/auth/login">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold shadow-xl shadow-blue-500/20"
                >
                  Get the Docker Image
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="https://github.com/actionchat/actionchat" target="_blank">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 bg-transparent border-white/20 text-white hover:bg-white/5"
                >
                  View on GitHub
                </Button>
              </Link>
            </div>

            <TerminalDemo />
          </div>
        </section>

        {/* The Problem */}
        <section className="container mx-auto px-6 py-20 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black mb-8">The Problem</h2>
            <p className="text-lg text-white/60 mb-8">You built the API. Now you have to build the UI.</p>
            
            <div className="space-y-4">
              <ProblemItem>
                <strong className="text-white">The Frontend Tax:</strong> You spend 3 days fighting with React, state management, and CSS just to make a &quot;Refund Button.&quot;
              </ProblemItem>
              <ProblemItem>
                <strong className="text-white">The Maintenance:</strong> Every time the API changes, the Admin Panel breaks.
              </ProblemItem>
              <ProblemItem>
                <strong className="text-white">The Context Switch:</strong> Support pings you on Slack to run SQL queries because the dashboard is too slow.
              </ProblemItem>
            </div>
          </div>
        </section>

        {/* The Solution */}
        <section className="container mx-auto px-6 py-20 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black mb-8">The Solution</h2>
            <p className="text-lg text-white/60 mb-8">
              ActionChat is a self-hosted container that acts as a <strong className="text-white">Natural Language Proxy</strong> for your API.
            </p>

            {/* Docker command */}
            <div className="bg-[#0d0d12] border border-white/10 rounded-xl p-4 mb-8 font-mono text-sm overflow-x-auto">
              <span className="text-white/40">$</span>
              <span className="text-cyan-400 ml-2">docker run</span>
              <span className="text-white/70"> -v ./openapi.json:/app/spec.json -p 8000:8000 actionchat/core</span>
            </div>

            <p className="text-white/60 mb-6">That&apos;s it. Your APIs are now chat-accessible.</p>
            
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl mb-6">
              <p className="text-white/80 text-sm">
                <strong className="text-white">This isn&apos;t a chatbot.</strong> Chatbots link you to KB articles. 
                ActionChat <em>executes the refund</em>, <em>rotates the API key</em>, <em>suspends the account</em>. 
                It does the thing.
              </p>
            </div>

            <p className="text-white/60">
              Works with your own internal apps <em>or</em> external APIs — Stripe, Twilio, your own backend. 
              If it has an OpenAPI spec, you can chat with it.
            </p>
          </div>
        </section>

        {/* Why Devs Love It */}
        <section className="container mx-auto px-6 py-20 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black mb-8">Why Devs Love It</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Check className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="font-bold text-white">Zero UI Work</h3>
                </div>
                <p className="text-white/50 text-sm">If it&apos;s in the Swagger spec, it&apos;s in the chat. No forms to build.</p>
              </div>

              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="font-bold text-white">Hallucination-Proof</h3>
                </div>
                <p className="text-white/50 text-sm">Validates all parameters against your API schema <em>before</em> execution.</p>
              </div>

              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Server className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="font-bold text-white">Data Sovereignty</h3>
                </div>
                <p className="text-white/50 text-sm">Self-hosted. No customer data ever leaves your VPC.</p>
              </div>

              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="font-bold text-white">Team Safe</h3>
                </div>
                <p className="text-white/50 text-sm">Granular permissions. Give Support read-only access while you keep admin.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-6 py-20 border-t border-white/5">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-black mb-4">
              Ready to delete your backlog?
            </h2>
            <p className="text-white/50 mb-8">
              Don&apos;t build another form. Just build the API.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="https://github.com/actionchat/actionchat" target="_blank">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold"
                >
                  Star on GitHub
                </Button>
              </Link>
              <Link href="/docs">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 bg-transparent border-white/20 text-white hover:bg-white/5"
                >
                  Read the Docs
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-3">
            <TargetIcon className="w-5 h-5" />
            <span>&copy; {new Date().getFullYear()} ActionChat. MIT License.</span>
          </div>
          <div className="flex gap-6">
            <Link href="https://github.com/actionchat/actionchat" target="_blank" className="hover:text-white/50 transition-colors">GitHub</Link>
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/tos" className="hover:text-white/50 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <PublicOnly redirectTo="/sources">
      <HomeContent />
    </PublicOnly>
  );
}
