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
} from "@/components/compare";
import {
  Clock,
  DollarSign,
  MessageSquare,
  AlertTriangle,
  Layers,
  Code,
  Check,
  X,
} from "lucide-react";

// Real quotes from Retool forum, G2, and reviews
const QUOTES = [
  {
    quote: "Current pricing made it almost impossible to convince my new small business customers to start using Retool. Everyone tells me even Notion is more affordable.",
    source: "Retool Forum",
    issue: "Pricing",
  },
  {
    quote: "You have to be a decently experienced developer to succeed with Retool. Even some IT folks with basic coding skills have reported struggling with its steep learning curve.",
    source: "Industry Review",
    issue: "Learning Curve",
  },
  {
    quote: "Teams allows anyone to edit the application. This is obviously not helpful when you have users who are not developers. Business allows for developers and users — but costs 3x more.",
    source: "Retool Forum",
    issue: "Plan Gating",
  },
  {
    quote: "Most of my customers use Notion the whole day ($7 per seat) but they use Retool only once a day, maybe only once a week. The per-seat model doesn't fit.",
    source: "Retool Forum",
    issue: "Per-Seat Cost",
  },
  {
    quote: "Building truly great applications—the scalable, performant, and complex ones—requires navigating a steep learning curve.",
    source: "G2 Review",
    issue: "Complexity",
  },
  {
    quote: "Retool works best when you already have an engineering team. But most small and medium-sized businesses don't.",
    source: "Noloco Blog",
    issue: "Developer Required",
  },
];

const COMPARISON_DATA = [
  { feature: "Interface", us: "Natural language", them: "Drag-and-drop builder", highlight: true },
  { feature: "Build time per workflow", us: "None", them: "Hours to days", highlight: true },
  { feature: "Technical skills needed", us: "None", them: "JavaScript + SQL", highlight: true },
  { feature: "Pricing model", us: "Free (self-host)", them: "Per-seat ($10-65/user)", highlight: true },
  { feature: "Open Source", us: true, them: false },
  { feature: "Self-hostable", us: "Free", them: "Enterprise only", highlight: true },
  { feature: "Human-in-the-loop", us: true, them: "Build it yourself", highlight: true },
  { feature: "Audit trail", us: true, them: "Business+ plan" },
  { feature: "Team permissions", us: true, them: "Business+ plan" },
  { feature: "Custom UI", us: false, them: true },
  { feature: "Dashboards & charts", us: false, them: true },
  { feature: "User training required", us: "None", them: "Per tool built", highlight: true },
  { feature: "Maintenance burden", us: "None", them: "Ongoing", highlight: true },
];

const SOURCES = [
  { url: "https://community.retool.com/t/current-pricing-made-it-impossible-to-attract-new-customers/39824", label: "Retool Forum - Pricing Discussion" },
  { url: "https://www.g2.com/products/retool/reviews", label: "G2 - Retool Reviews" },
  { url: "https://www.vendr.com/marketplace/retool", label: "Vendr - Retool Pricing Data" },
  { url: "https://www.superblocks.com/compare/retool-pricing-cost", label: "Superblocks - Retool TCO Analysis" },
  { url: "https://noloco.io/blog/retool-alternatives", label: "Noloco - Retool Alternatives" },
  { url: "https://www.retoolers.io/blog-posts/honest-retool-review-in-2025-pros-and-cons", label: "Retoolers - Honest Review 2025" },
];

export default function RetoolComparison() {
  return (
    <CompareLayout currentPage="/compare/retool">
      <CompareHero
        badge="Comparison"
        title={<>ActionChat vs Retool<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Stop Building. Start Doing.</span></>}
        subtitle="Retool is powerful for building admin panels. But if your team just needs to <strong>execute operations tasks</strong>, why build a UI at all?"
        highlight="Skip the admin panel. Just chat."
        highlightIcon={MessageSquare}
      />

      {/* Quick Stats */}
      <Section border={false}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="2 min" label="ActionChat Setup" icon={Clock} color="green" />
          <StatCard value="Free*" label="ActionChat + Your LLM" icon={DollarSign} color="green" />
          <StatCard value="Weeks" label="Retool Build Time" icon={Clock} color="orange" />
          <StatCard value="$10-65/user" label="Retool Monthly" icon={DollarSign} color="red" />
        </div>
      </Section>

      {/* Core Difference */}
      <Section border={false}>
        <TwoColumnCompare
          left={
            <FeatureBox
              icon={Layers}
              title="Retool: Build an Admin Panel"
              description="With Retool, you drag-and-drop components, write SQL queries, connect APIs, and build a custom UI for every workflow. Then maintain it."
              color="orange"
              items={[
                { good: false, text: "Design UI layouts for each use case" },
                { good: false, text: "Write SQL queries and JavaScript" },
                { good: false, text: "Train users on each new tool" },
                { good: false, text: "Pay per seat, even for occasional use" },
              ]}
            />
          }
          right={
            <FeatureBox
              icon={MessageSquare}
              title="ActionChat: Just Say It"
              description="With ActionChat, you describe what you want in plain English. No building. No queries. No maintenance."
              color="green"
              items={[
                { good: true, text: '"Refund order #992 for bob@example.com"' },
                { good: true, text: '"Cancel subscription and prorate credit"' },
                { good: true, text: '"Move user to the Enterprise org"' },
                { good: true, text: "Confirms before destructive actions" },
              ]}
            />
          }
        />
      </Section>

      {/* TL;DR */}
      <Section border={false}>
        <div className="p-8 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-2xl">
          <h2 className="text-2xl font-black mb-4">TL;DR</h2>
          <TwoColumnCompare
            left={
              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-3">Choose ActionChat if:</h3>
                <ul className="space-y-2 text-white/70">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Your ops team needs to execute tasks, not build tools</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You want zero build time — connect APIs and go</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Non-technical users need to run operations</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You don't want to pay $10-65/user/month</li>
                </ul>
              </div>
            }
            right={
              <div>
                <h3 className="text-lg font-bold text-white/60 mb-3">Choose Retool if:</h3>
                <ul className="space-y-2 text-white/50">
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You need custom dashboards with charts and tables</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You have developers to build and maintain tools</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You need complex multi-step forms with validation</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You want pixel-perfect control over the UI</li>
                </ul>
              </div>
            }
          />
        </div>
      </Section>

      {/* Quotes */}
      <Section>
        <SectionTitle
          title="What People Are Saying About Retool"
          subtitle="Real feedback from the Retool community forum, G2, and industry reviews."
        />
        <div className="grid md:grid-cols-2 gap-6">
          {QUOTES.map((q, i) => (
            <QuoteCard key={i} {...q} />
          ))}
        </div>
      </Section>

      {/* Cost Breakdown */}
      <Section>
        <SectionTitle
          title="The Real Cost of Retool"
          subtitle="Per-seat pricing adds up fast. And that's before you count the dev time to build."
        />
        <TwoColumnCompare
          left={
            <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-red-400 mb-4">Retool Costs (10-Person Team)</h3>
              <ul className="space-y-3">
                <li className="flex justify-between text-white/70"><span>Team Plan (5 builders)</span><span className="text-white/50">$50/mo</span></li>
                <li className="flex justify-between text-white/70"><span>End Users (5 @ $5/mo)</span><span className="text-white/50">$25/mo</span></li>
                <li className="flex justify-between text-white/70"><span>— Or Business Plan —</span><span className="text-white/50"></span></li>
                <li className="flex justify-between text-white/70"><span>5 Standard @ $65/mo</span><span className="text-white/50">$325/mo</span></li>
                <li className="flex justify-between text-white/70"><span>5 End Users @ $18/mo</span><span className="text-white/50">$90/mo</span></li>
                <li className="flex justify-between text-white/70"><span>Dev time to build tools</span><span className="text-white/50">40+ hours</span></li>
                <li className="flex justify-between pt-3 border-t border-red-500/20 text-white font-bold"><span>Monthly + Build</span><span className="text-red-400">$75-415/mo + dev time</span></li>
              </ul>
            </div>
          }
          right={
            <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-green-400 mb-4">ActionChat Costs (Any Team)</h3>
              <ul className="space-y-3">
                <li className="flex justify-between text-white/70"><span>Self-Hosted</span><span className="text-green-400">Free</span></li>
                <li className="flex justify-between text-white/70"><span>Unlimited users</span><span className="text-green-400">Yes</span></li>
                <li className="flex justify-between text-white/70"><span>Build time</span><span className="text-green-400">0 hours</span></li>
                <li className="flex justify-between text-white/70"><span>Setup time</span><span className="text-green-400">2 minutes</span></li>
                <li className="flex justify-between text-white/70"><span>Training required</span><span className="text-green-400">None (it's chat)</span></li>
                <li className="flex justify-between text-white/70"><span>Your LLM API costs</span><span className="text-white/50">$5-20/mo typical</span></li>
                <li className="flex justify-between pt-3 border-t border-green-500/20 text-white font-bold"><span>Total</span><span className="text-green-400">$5-20/mo typical</span></li>
              </ul>
            </div>
          }
        />
        <div className="mt-8 p-6 bg-white/[0.02] border border-white/10 rounded-xl">
          <h4 className="text-white font-bold mb-2">Enterprise? It gets worse.</h4>
          <p className="text-white/60 text-sm">
            According to Vendr, a typical enterprise Retool deployment (50 Standard Users, 200 End Users) has a list price of <strong className="text-red-400">$204,000/year</strong>. Even with negotiation, companies pay $95k-156k annually. ActionChat? Still free to self-host.
          </p>
        </div>
      </Section>

      {/* Developer Problem */}
      <Section>
        <AlertBox icon={Code} title="Retool Still Requires Developers" color="yellow">
          <p className="text-white/70 mb-4">Despite being "low-code," Retool requires JavaScript and SQL knowledge for anything beyond basic CRUD:</p>
          <ul className="space-y-2 text-white/60 text-sm">
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> 28 G2 reviews mention "steep learning curve"</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "Building apps as a non-technical user might be a bridge too far"</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Complex apps require "learning The Retool Way" — async JavaScript patterns, query chaining</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "Ideal for businesses with dedicated development teams"</li>
          </ul>
          <p className="text-white/50 text-sm mt-4">
            ActionChat requires zero technical knowledge. If you can describe what you want, you can use it.
          </p>
        </AlertBox>
      </Section>

      {/* Feature Comparison */}
      <Section>
        <SectionTitle title="Feature Comparison" />
        <ComparisonTable usLabel="ActionChat" themLabel="Retool">
          {COMPARISON_DATA.map((row, i) => (
            <ComparisonRow key={i} feature={row.feature} us={row.us} them={row.them} highlight={row.highlight} />
          ))}
        </ComparisonTable>
      </Section>

      {/* Different Tools */}
      <Section>
        <SectionTitle
          title="Different Tools for Different Jobs"
          subtitle="Retool is great at what it does. But many ops tasks don't need a custom UI — they just need to get done."
        />
        <TwoColumnCompare
          left={
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">Use ActionChat for...</h3>
              <ul className="space-y-3 text-white/70">
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Ad-hoc operations tasks (refunds, cancellations)</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Tasks that need human confirmation</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Non-technical support/ops teams</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> When you can't justify dev time to build a tool</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Infrequent tasks that don't warrant a UI</li>
              </ul>
            </div>
          }
          right={
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
              <h3 className="text-lg font-bold text-orange-400 mb-4">Use Retool for...</h3>
              <ul className="space-y-3 text-white/70">
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> Complex dashboards with real-time data</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> Multi-step forms with validation logic</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> When you need pixel-perfect UI control</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> Heavy data visualization and charts</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> When you have developers to build & maintain</li>
              </ul>
            </div>
          }
        />
      </Section>

      {/* The Question */}
      <Section>
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-black mb-6">
            Do you need an admin panel?<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Or do you just need to get things done?</span>
          </h2>
          <p className="text-white/60 mb-4 max-w-3xl mx-auto">
            For many operations tasks — refunds, account updates, subscription changes — you don't need a custom UI. You don't need to drag-and-drop components or write SQL queries. You just need to tell the system what to do and have it confirm before acting.
          </p>
          <p className="text-white/60">
            That's ActionChat. <strong className="text-white">Skip the build. Just chat.</strong>
          </p>
        </div>
      </Section>

      <CompareCTA
        title="Ready to stop building?"
        subtitle="ActionChat is free, open source, and takes 2 minutes to set up. No per-seat fees. No JavaScript required."
      />

      <SourcesSection sources={SOURCES} />
    </CompareLayout>
  );
}
