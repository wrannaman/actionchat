"use client";

import {
  CompareLayout,
  CompareHero,
  ComparisonTable,
  ComparisonRow,
  QuoteCard,
  StatCard,
  SourcesSection,
  CompareCTA,
  Section,
  SectionTitle,
  TwoColumnCompare,
  FeatureBox,
  AlertBox,
  UseCaseGrid,
} from "@/components/compare";
import {
  Clock,
  DollarSign,
  AlertTriangle,
  X,
  Check,
} from "lucide-react";

// Page-specific content
const QUOTES = [
  {
    quote: "For the life of me I can't get it to write any files or search anything online... basically just acting like any other locally run chatbot.",
    source: "Reddit User",
    issue: "Setup Issues",
  },
  {
    quote: "A scan of instances running on VPS providers shows many with the gateway port open with zero authentication. API keys, email access, file permissions — exposed directly to the internet.",
    source: "Security Researcher",
    issue: "Security Risk",
  },
  {
    quote: "Five hours of setup now beats explaining to your boss why emails got leaked.",
    source: "Dev.to Article",
    issue: "Complexity",
  },
  {
    quote: "At $500–$5,000 per month, a full-time Opus agent is no longer cheap automation. It competes directly with human labor.",
    source: "Technical Review",
    issue: "Cost",
  },
  {
    quote: "Suddenly, you're not just a user, you're a system administrator who has to worry about server maintenance.",
    source: "Industry Analysis",
    issue: "Maintenance",
  },
  {
    quote: "It's a project for developers, hobbyists, and tech enthusiasts who enjoy tinkering and are okay with the risks. Completely unsuitable for any professional setting.",
    source: "eesel.ai Review",
    issue: "Not for Business",
  },
];

const COMPARISON_DATA = [
  { feature: "Setup Time", us: "2 minutes", them: "5+ hours", highlight: true },
  { feature: "Command Line Required", us: false, them: true, highlight: true },
  { feature: "VPS/Server Required", us: false, them: true, highlight: true },
  { feature: "LLM Cost (typical)", us: "$5-20/mo", them: "$180-750+/mo", highlight: true },
  { feature: "Open Source", us: true, them: true },
  { feature: "OpenAPI Integration", us: "Paste spec, done", them: "Build custom plugins" },
  { feature: "Team Permissions", us: true, them: false, highlight: true },
  { feature: "Audit Trail", us: true, them: false, highlight: true },
  { feature: "Human Confirmation", us: "Built-in", them: "DIY", highlight: true },
  { feature: "Security Defaults", us: "Hardened", them: "Requires config" },
  { feature: "Non-Technical Users", us: true, them: false, highlight: true },
];

const SOURCES = [
  { url: "https://openclaw.ai/", label: "OpenClaw Official Website" },
  { url: "https://www.eesel.ai/blog/clawd-bot-review", label: "eesel.ai - Clawd Bot Review" },
  { url: "https://www.theregister.com/2026/01/27/clawdbot_moltbot_security_concerns/", label: "The Register - Security Concerns" },
  { url: "https://news.ycombinator.com/item?id=46783574", label: "Hacker News Discussion" },
  { url: "https://dev.to/er_li_92a27f8612f9f070e18/i-accidentally-turned-my-clawdbot-into-a-data-leak-dont-make-my-mistake-3dkp", label: "Dev.to - Data Leak Article" },
];

const USE_CASES = [
  "Refund a customer",
  "Cancel subscription",
  "Move user to another org",
  "Reset user password",
  "Extend trial period",
  "Update billing info",
  "Apply discount code",
  "Merge duplicate accounts",
  "Transfer seat license",
];

export default function OpenClawComparison() {
  return (
    <CompareLayout currentPage="/compare/openclaw">
      <CompareHero
        badge="Comparison"
        title={<>ActionChat vs OpenClaw<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Production-Ready vs DIY Project</span></>}
        subtitle="OpenClaw is a viral hacker project—cool for tinkering, but takes <strong>5+ hours to set up</strong> and costs <strong>$200+/month</strong> to run. ActionChat is ready in 2 minutes."
        highlight="2 min setup vs 5+ hours"
        highlightIcon={Clock}
      />

      {/* Quick Stats */}
      <Section border={false}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="2 min" label="ActionChat Setup" icon={Clock} color="green" />
          <StatCard value="$5-20/mo" label="ActionChat LLM Cost" icon={DollarSign} color="green" />
          <StatCard value="5+ hrs" label="OpenClaw Setup" icon={Clock} color="red" />
          <StatCard value="$200+/mo" label="OpenClaw LLM Cost" icon={DollarSign} color="red" />
        </div>
      </Section>

      {/* TL;DR */}
      <Section border={false}>
        <div className="p-8 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-2xl">
          <h2 className="text-2xl font-black mb-4">TL;DR — Fun Project vs Production Tool</h2>
          <TwoColumnCompare
            left={
              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-3">Choose ActionChat if:</h3>
                <ul className="space-y-2 text-white/70">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You need something <strong>working today</strong>, not next weekend</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Your team does refunds, account management, billing tasks</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You want zero installation — just connect your APIs and go</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You need audit trails, permissions, and confirmations</li>
                </ul>
              </div>
            }
            right={
              <div>
                <h3 className="text-lg font-bold text-red-400 mb-3">Choose OpenClaw if:</h3>
                <ul className="space-y-2 text-white/70">
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You enjoy <strong>tinkering</strong> and system administration</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You want a personal AI assistant for hobby projects</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You have 5+ hours to set up and configure</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You have budget for $180-750/month in API costs</li>
                </ul>
              </div>
            }
          />
        </div>
      </Section>


      {/* Quotes */}
      <Section>
        <SectionTitle
          title="What People Are Saying About OpenClaw"
          subtitle="Real feedback from developers and users on Reddit, Hacker News, and review sites."
        />
        <div className="grid md:grid-cols-2 gap-6">
          {QUOTES.map((q, i) => (
            <QuoteCard key={i} {...q} />
          ))}
        </div>
      </Section>

      {/* Feature Comparison */}
      <Section>
        <SectionTitle title="Feature Comparison" />
        <ComparisonTable usLabel="ActionChat" themLabel="OpenClaw">
          {COMPARISON_DATA.map((row, i) => (
            <ComparisonRow key={i} feature={row.feature} us={row.us} them={row.them} highlight={row.highlight} />
          ))}
        </ComparisonTable>
      </Section>

      {/* Use Cases */}
      <Section>
        <SectionTitle title="What ActionChat Does Best" subtitle="Routine operations your team does every day — now in natural language." />
        <UseCaseGrid items={USE_CASES} />
        <p className="text-center text-white/40 mt-8 text-sm">
          Works with any OpenAPI spec. Connect Stripe, your internal APIs, and 24+ integrations.
        </p>
      </Section>

      {/* Cost Comparison */}
      <Section>
        <SectionTitle
          title="Operating Cost Comparison"
          subtitle="ActionChat's request-based model vs OpenClaw's always-on agent."
        />
        <TwoColumnCompare
          left={
            <div className="p-8 bg-green-500/5 border border-green-500/20 rounded-2xl">
              <h3 className="text-xl font-bold text-green-400 mb-4">ActionChat</h3>
              <ul className="space-y-3">
                <li className="flex justify-between text-white/70"><span>Self-Hosted</span><span className="text-green-400">Free</span></li>
                <li className="flex justify-between text-white/70"><span>Setup Time</span><span className="text-green-400">2 minutes</span></li>
                <li className="flex justify-between text-white/70"><span>LLM Costs</span><span className="text-white/50">$5-20/mo typical</span></li>
                <li className="flex justify-between text-white/70"><span>Token Model</span><span className="text-green-400">Request-based</span></li>
                <li className="flex justify-between pt-3 border-t border-green-500/20 text-white font-bold"><span>Total</span><span className="text-green-400">$5-20/mo</span></li>
              </ul>
            </div>
          }
          right={
            <div className="p-8 bg-red-500/5 border border-red-500/20 rounded-2xl">
              <h3 className="text-xl font-bold text-red-400 mb-4">OpenClaw</h3>
              <ul className="space-y-3">
                <li className="flex justify-between text-white/70"><span>VPS/Hardware</span><span className="text-white/50">$5-20/mo</span></li>
                <li className="flex justify-between text-white/70"><span>Setup Time</span><span className="text-white/50">5+ hours</span></li>
                <li className="flex justify-between text-white/70"><span>LLM Costs (Moderate)</span><span className="text-white/50">$180-240/mo</span></li>
                <li className="flex justify-between text-white/70"><span>Token Model</span><span className="text-red-400">Always-on agent</span></li>
                <li className="flex justify-between pt-3 border-t border-red-500/20 text-white font-bold"><span>Total</span><span className="text-red-400">$185-770+/mo</span></li>
              </ul>
            </div>
          }
        />
      </Section>

      {/* Security */}
      <Section>
        <AlertBox icon={AlertTriangle} title="OpenClaw Security Considerations" color="yellow">
          <p className="text-white/70 mb-4">OpenClaw is a powerful tool that requires careful security configuration:</p>
          <ul className="space-y-2 text-white/60 text-sm">
            <li className="flex items-start gap-2"><X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Requires manual security hardening</li>
            <li className="flex items-start gap-2"><X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Gateway authentication not enabled by default</li>
            <li className="flex items-start gap-2"><X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Shell access and file permissions need careful configuration</li>
            <li className="flex items-start gap-2"><X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Docker sandboxing requires manual setup</li>
          </ul>
          <p className="text-white/50 text-sm mt-4">
            ActionChat is built with security first: RLS policies, audit trails, no shell access, and human-in-the-loop for all destructive operations.
          </p>
        </AlertBox>
      </Section>

      <CompareCTA
        title="Want it working today, not next weekend?"
        subtitle="ActionChat is free, open source, and takes 2 minutes to set up. No VPS, no command line."
      />

      <SourcesSection sources={SOURCES} />
    </CompareLayout>
  );
}
