"use client";

import { Button } from "@/components/ui/button";
import { PublicOnly } from "@/components/auth-guard";
import {
  ArrowRight,
  GitBranch,
  Check,
  Shield,
  Server,
  Users,
  Zap,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Ticket,
  Database,
  Search,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Integration catalog data (subset for landing page)
const FEATURED_USE_CASES = [
  { action: "Move user to another org", integration: "Your API", category: "support", icon: Users },
  { action: "Refund a customer", integration: "Stripe", category: "payments", icon: CreditCard },
  { action: "Merge duplicate accounts", integration: "Your API", category: "support", icon: Users },
  { action: "Send an SMS alert", integration: "Twilio", category: "communication", icon: MessageSquare },
  { action: "Create a GitHub issue", integration: "GitHub", category: "devops", icon: GitBranch },
  { action: "Post to Slack", integration: "Slack", category: "communication", icon: MessageSquare },
  { action: "Trigger a PagerDuty alert", integration: "PagerDuty", category: "devops", icon: AlertTriangle },
  { action: "Update a Linear ticket", integration: "Linear", category: "project_management", icon: Ticket },
  { action: "Create a Jira ticket", integration: "Jira", category: "project_management", icon: Ticket },
  { action: "Send an email", integration: "SendGrid", category: "communication", icon: MessageSquare },
  { action: "Create a contact", integration: "HubSpot", category: "crm", icon: Users },
  { action: "Fix billing mismatch", integration: "Your API", category: "support", icon: CreditCard },
];

const INTEGRATION_LOGOS = [
  { name: "Stripe", logo: "/integrations/stripe.svg" },
  { name: "Twilio", logo: "/integrations/twilio.svg" },
  { name: "GitHub", logo: "/integrations/github.svg" },
  { name: "Slack", logo: "/integrations/slack.svg" },
  { name: "PagerDuty", logo: "/integrations/pagerduty.svg" },
  { name: "Linear", logo: "/integrations/linear.svg" },
  { name: "HubSpot", logo: "/integrations/hubspot.svg" },
  { name: "Notion", logo: "/integrations/notion.svg" },
];

const CATEGORIES = [
  { id: "all", name: "All", count: 24 },
  { id: "payments", name: "Payments", count: 2 },
  { id: "communication", name: "Communication", count: 4 },
  { id: "devops", name: "DevOps", count: 5 },
  { id: "project_management", name: "Project Management", count: 2 },
  { id: "support", name: "Support", count: 3 },
  { id: "database", name: "Database", count: 3 },
];

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

function UseCaseCard({ action, integration, icon: Icon }) {
  return (
    <div className="group p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center shrink-0 group-hover:from-blue-500/20 group-hover:to-cyan-500/20 transition-colors">
          <Icon className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <p className="text-white font-medium text-sm">{action}</p>
          <p className="text-white/40 text-xs mt-0.5">via {integration}</p>
        </div>
      </div>
    </div>
  );
}

function LiveDemo() {
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
          <div className="flex gap-2">
            <span className="text-cyan-400 shrink-0">you:</span>
            <span className="text-white">&quot;Refund order #992 for bob@example.com&quot;</span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400 shrink-0">ActionChat:</span>
            <span className="text-white/70">&quot;Found Order #992 ($50.00). Create refund?&quot;</span>
          </div>
          <div className="flex gap-4 items-center">
            <button className="px-4 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm border border-green-500/30 hover:bg-green-500/30 transition-colors">
              Yes, refund
            </button>
            <button className="px-4 py-1.5 bg-white/5 text-white/50 rounded-lg text-sm border border-white/10">
              Cancel
            </button>
          </div>
          <div className="flex items-center gap-2 text-green-400 pt-2 border-t border-white/5">
            <Check className="w-4 h-4" />
            <span>Refund created: re_3Qh7... &mdash; $50.00 to card ending 4242</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationLogo({ name, logo }) {
  return (
    <div className="flex items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-colors group" title={name}>
      <img 
        src={logo} 
        alt={name} 
        className="w-8 h-8 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
      />
    </div>
  );
}

function StepCard({ number, title, description }) {
  return (
    <div className="relative">
      <div className="absolute -left-3 top-0 w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
        {number}
      </div>
      <div className="pl-6">
        <h3 className="text-white font-bold mb-1">{title}</h3>
        <p className="text-white/50 text-sm">{description}</p>
      </div>
    </div>
  );
}

function PersonaCard({ title, description, icon: Icon }) {
  return (
    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <h3 className="text-white font-bold mb-2">{title}</h3>
      <p className="text-white/50 text-sm">{description}</p>
    </div>
  );
}

function HomeContent() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredUseCases = selectedCategory === "all"
    ? FEATURED_USE_CASES
    : FEATURED_USE_CASES.filter(uc => uc.category === selectedCategory);

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
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <Link href="/explore" className="hover:text-white transition-colors">Explore</Link>
            <Link href="https://github.com/actionchat/actionchat" target="_blank" className="hover:text-white transition-colors flex items-center gap-1">
              <GitBranch className="w-4 h-4" />
              GitHub
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero - Use Cases First */}
        <section className="container mx-auto px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm mb-6">
              <Zap className="w-4 h-4" />
              50+ Things You Can Do in 30 Seconds
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-[1.1]">
              AI That Actually <em className="not-italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Does</em> Things
            </h1>

            <p className="text-xl text-white/60 mb-4 max-w-2xl mx-auto">
              No install. No code. Just say what you want done.
            </p>

            <p className="text-lg text-white/40 mb-8 max-w-xl mx-auto">
              Connect your APIs in 30 seconds. Then talk to them like a human.
            </p>
          </div>
        </section>

        {/* Use Case Grid - THE MONEY SHOT */}
        <section className="container mx-auto px-6 pb-16">
          <div className="max-w-5xl mx-auto">
            {/* Category filters */}
            <div className="flex flex-wrap gap-2 mb-8 justify-center">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm transition-all ${
                    selectedCategory === cat.id
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Use case cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUseCases.map((uc, i) => (
                <UseCaseCard key={i} {...uc} />
              ))}
            </div>

            <div className="text-center mt-8">
              <Link href="/explore">
                <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/5">
                  Explore All 24+ Integrations
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Live Demo */}
        <section className="container mx-auto px-6 py-16 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-black mb-4">See It In Action</h2>
              <p className="text-white/60">Real API calls. Real confirmations. Real results.</p>
            </div>
            <LiveDemo />
          </div>
        </section>

        {/* Integration Logos */}
        <section className="container mx-auto px-6 py-16 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-white/40 text-sm mb-8">Works with the tools you already use</p>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {INTEGRATION_LOGOS.map((int, i) => (
                <IntegrationLogo key={i} {...int} />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-6 py-16 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black mb-12 text-center">How It Works</h2>
            <div className="space-y-8">
              <StepCard
                number={1}
                title="Pick what you want to do"
                description="Browse our catalog of 24+ integrations or add your own OpenAPI spec or MCP server."
              />
              <StepCard
                number={2}
                title="Add your API key"
                description="Your credentials stay with you. We never store or see your API keys."
              />
              <StepCard
                number={3}
                title="Chat. Done."
                description="Just tell ActionChat what you want. It confirms destructive actions before executing."
              />
            </div>
          </div>
        </section>

        {/* For Who */}
        <section className="container mx-auto px-6 py-16 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black mb-12 text-center">Built For</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <PersonaCard
                title="Support Teams"
                description="Move users between orgs, merge accounts, fix billing mismatches—without an engineering ticket. Turn 45-minute escalations into 30-second conversations."
                icon={MessageSquare}
              />
              <PersonaCard
                title="Ops Teams"
                description="One chat interface for all your tools. No more switching between 10 different dashboards."
                icon={Server}
              />
              <PersonaCard
                title="Founders"
                description="AI productivity without the setup. Get value in 30 seconds, not 30 days."
                icon={Zap}
              />
            </div>
          </div>
        </section>

        {/* Self-Hosted */}
        <section className="container mx-auto px-6 py-16 border-t border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm mb-6">
              <Shield className="w-4 h-4" />
              Self-Hosted & Open Source
            </div>
            <h2 className="text-2xl md:text-3xl font-black mb-4">Your Data Never Leaves Your Servers</h2>
            <p className="text-white/60 mb-8">Run ActionChat on your own infrastructure. MIT licensed. No vendor lock-in.</p>

            <div className="bg-[#0d0d12] border border-white/10 rounded-xl p-4 mb-8 font-mono text-sm text-left overflow-x-auto">
              <span className="text-white/40">$</span>
              <span className="text-cyan-400 ml-2">docker run</span>
              <span className="text-white/70"> -p 3000:3000 actionchat/actionchat</span>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-6 py-20 border-t border-white/5">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-black mb-4">
              Ready to do things in 30 seconds?
            </h2>
            <p className="text-white/50 mb-8">
              Free forever for self-hosted. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/login">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold shadow-xl shadow-blue-500/20"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/explore">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 bg-transparent border-white/20 text-white hover:bg-white/5"
                >
                  Explore Integrations
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
            <Link href="/explore" className="hover:text-white/50 transition-colors">Explore</Link>
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
    <PublicOnly redirectTo="/chat">
      <HomeContent />
    </PublicOnly>
  );
}
