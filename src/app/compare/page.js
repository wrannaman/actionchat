"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, GitBranch, Sparkles, TrendingDown, Code2, Lock, DollarSign } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { CompareLayout } from "@/components/compare";

const COMPARISONS = [
  {
    href: "/compare/zapier",
    name: "Zapier",
    logo: "/competitors/zapier.svg",
    tagline: "Stop paying per task",
    description: "Zapier charges per task—bills explode as you scale. ActionChat has no per-task fees. You just pay your LLM provider.",
    stat: "10x cheaper",
    statIcon: DollarSign,
    color: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    hoverBorder: "hover:border-orange-500/40",
  },
  {
    href: "/compare/retool",
    name: "Retool",
    logo: "/competitors/retool.svg",
    tagline: "Skip the dashboard building",
    description: "Retool requires developers to build every screen. ActionChat turns natural language into API calls—no UI required.",
    stat: "Zero UI code",
    statIcon: Code2,
    color: "from-slate-400 to-slate-600",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
    hoverBorder: "hover:border-slate-400/40",
  },
  {
    href: "/compare/lindy",
    name: "Lindy",
    logo: "/competitors/lindy.svg",
    tagline: "No credit anxiety",
    description: "Lindy users report billing nightmares and credit burns. ActionChat is open source—no credits, no surprises, pay your LLM directly.",
    stat: "2.6/5 Trustpilot",
    statIcon: DollarSign,
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    hoverBorder: "hover:border-purple-500/40",
  },
  {
    href: "/compare/openclaw",
    name: "OpenClaw",
    logo: "/competitors/openclaw.svg",
    tagline: "Ready now, not 5 hours from now",
    description: "OpenClaw is a cool hacker project that takes hours to set up. ActionChat is ready in 2 minutes—no VPS, no command line, just paste your API spec.",
    stat: "10x faster setup",
    statIcon: TrendingDown,
    color: "from-red-500 to-rose-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    hoverBorder: "hover:border-red-500/40",
  },
];

function ComparisonCard({ comparison }) {
  const StatIcon = comparison.statIcon;
  return (
    <Link href={comparison.href} className="group block h-full">
      <div className={`relative h-full p-6 rounded-2xl border ${comparison.borderColor} ${comparison.bgColor} ${comparison.hoverBorder} hover:bg-white/[0.03] transition-all duration-300 overflow-hidden`}>
        {/* Subtle gradient overlay on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br ${comparison.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />

        {/* Glow effect */}
        <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${comparison.color} rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

        <div className="relative z-10 flex flex-col h-full">
          {/* Header with logo and stat */}
          <div className="flex items-start justify-between mb-5">
            <div className={`relative w-12 h-12 rounded-xl ${comparison.bgColor} border ${comparison.borderColor} p-2 group-hover:scale-105 transition-transform`}>
              <Image
                src={comparison.logo}
                alt={`${comparison.name} logo`}
                width={48}
                height={48}
                className="w-full h-full object-contain"
              />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${comparison.bgColor} border ${comparison.borderColor}`}>
              <StatIcon className="w-3.5 h-3.5" style={{ color: comparison.color.includes('orange') ? '#f97316' : comparison.color.includes('slate') ? '#94a3b8' : comparison.color.includes('purple') ? '#a855f7' : '#10b981' }} />
              <span className={`text-xs font-bold uppercase tracking-wider bg-gradient-to-r ${comparison.color} bg-clip-text text-transparent`}>
                {comparison.stat}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-white transition-colors">
              ActionChat vs {comparison.name}
            </h3>
            <p className={`text-sm font-semibold bg-gradient-to-r ${comparison.color} bg-clip-text text-transparent mb-3`}>
              {comparison.tagline}
            </p>
            <p className="text-white/50 text-sm leading-relaxed">
              {comparison.description}
            </p>
          </div>

          {/* CTA */}
          <div className="mt-5 pt-4 border-t border-white/5">
            <div className={`flex items-center text-sm font-semibold bg-gradient-to-r ${comparison.color} bg-clip-text text-transparent group-hover:opacity-100 opacity-70 transition-opacity`}>
              See full comparison
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform text-current" style={{ color: comparison.color.includes('orange') ? '#f97316' : comparison.color.includes('slate') ? '#94a3b8' : comparison.color.includes('purple') ? '#a855f7' : comparison.color.includes('red') ? '#ef4444' : '#10b981' }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatBox({ value, label, icon: Icon }) {
  return (
    <div className="relative group p-5 rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 hover:border-white/10 transition-all">
      <div className="absolute top-4 right-4">
        <Icon className="w-5 h-5 text-white/10 group-hover:text-cyan-500/30 transition-colors" />
      </div>
      <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-1">
        {value}
      </div>
      <div className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
        {label}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <CompareLayout currentPage="/compare">
      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-blue-300 text-sm mb-8">
            <Sparkles className="w-4 h-4" />
            Honest Comparisons
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6">
            ActionChat vs{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 animate-gradient">
              The Alternatives
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-4">
            See how ActionChat stacks up against other automation and internal tools platforms.
          </p>
          <p className="text-white/30 text-sm">
            No marketing fluff—just facts backed by real user reviews.
          </p>
        </div>
      </section>

      {/* Comparison Grid */}
      <section className="pb-20">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {COMPARISONS.map((comparison) => (
              <ComparisonCard key={comparison.href} comparison={comparison} />
            ))}
          </div>
        </div>
      </section>

      {/* Why ActionChat Section */}
      <section className="py-20 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-3">
                Why Teams Choose ActionChat
              </h2>
              <p className="text-white/40">The numbers speak for themselves</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <StatBox value="Free" label="Self-host. MIT licensed. You pay your LLM." icon={DollarSign} />
              <StatBox value="5 min" label="Paste OpenAPI spec. Start chatting." icon={TrendingDown} />
              <StatBox value="100%" label="Human-in-the-loop. Full audit trail." icon={Lock} />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/5">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              Ready to try ActionChat?
            </h2>
            <p className="text-white/50 mb-8">
              Connect your first API in minutes. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/login">
                <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold px-8 py-6 text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow">
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="https://github.com/wrannaman/actionchat" target="_blank">
                <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white px-8 py-6 text-lg">
                  <GitBranch className="mr-2 h-5 w-5" />
                  View on GitHub
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </CompareLayout>
  );
}
