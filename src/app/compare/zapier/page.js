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
  MessageSquare,
  Boxes,
  MousePointer,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";

// Page-specific content - easy to update
const QUOTES = [
  {
    quote: "We paid $427 last January for the Pro plan. They just charged me $1,068 for the same plan on a renewal with no notice of a price increase.",
    source: "Trustpilot User",
    issue: "Price Shock",
  },
  {
    quote: "Our Zapier bill just jumped from £400 to £1,200 this month.",
    source: "Business User",
    issue: "Cost Explosion",
  },
  {
    quote: "The biggest downside is the cost. I use only a very small portion of the task limits each month, yet I'm still required to pay...",
    source: "G2 Review",
    issue: "Pricing",
  },
  {
    quote: "Extremely expensive and full of antiquated limits that are out of touch with current developments.",
    source: "Capterra Review",
    issue: "Outdated Model",
  },
  {
    quote: "When one step in a multi-step workflow fails, the entire automation stops, leaving subsequent steps unprocessed.",
    source: "Technical Review",
    issue: "Reliability",
  },
  {
    quote: "If you sign up for a paid plan and decide you don't need the service any longer, they will NOT refund you for any reason.",
    source: "User Review",
    issue: "No Refunds",
  },
];

const COMPARISON_DATA = [
  { feature: "Interface", us: "Natural language", them: "Visual builder", highlight: true },
  { feature: "Setup per workflow", us: "None", them: "Build each Zap", highlight: true },
  { feature: "Pricing Model", us: "Free + LLM costs", them: "Per-task", highlight: true },
  { feature: "Self-Hostable", us: true, them: false, highlight: true },
  { feature: "Open Source", us: true, them: false },
  { feature: "Human-in-the-Loop", us: true, them: "Limited", highlight: true },
  { feature: "Audit Trail", us: true, them: "Enterprise only" },
  { feature: "Team Permissions", us: true, them: "Paid plans" },
  { feature: "Multi-step Workflows", us: "Automatic", them: "Build manually" },
  { feature: "Field Mapping", us: "AI handles it", them: "Manual", highlight: true },
  { feature: "Workflow Maintenance", us: "None", them: "Ongoing", highlight: true },
  { feature: "Free Plan Limits", us: "No task limits", them: "100 tasks, 2-step" },
  { feature: "Integrations", us: "Any OpenAPI", them: "7,000+ apps" },
];

const SOURCES = [
  { url: "https://www.trustpilot.com/review/zapier.com", label: "Trustpilot - Zapier Reviews" },
  { url: "https://www.g2.com/products/zapier/reviews", label: "G2 - Zapier Reviews" },
  { url: "https://www.capterra.com/p/130182/Zapier/reviews/", label: "Capterra - Zapier Reviews" },
  { url: "https://www.activepieces.com/blog/zapier-pricing", label: "Activepieces - Zapier Pricing Breakdown" },
  { url: "https://thatapicompany.com/zapier-pricing-breakdown-hidden-costs-that-shocked-our-clients/", label: "Hidden Costs Analysis" },
  { url: "https://www.autonoly.com/blog/689c0d2be633225ff19e1004/why-your-zapier-workflows-keep-breaking-7-fixes-for-unreliable-automation", label: "Workflow Reliability Issues" },
];

export default function ZapierComparison() {
  return (
    <CompareLayout currentPage="/compare/zapier">
      <CompareHero
        badge="Comparison"
        title={<>ActionChat vs Zapier<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Chat vs. Workflow Builder</span></>}
        subtitle="Zapier is great for connecting apps with visual workflows. But if you just want to <strong>say what you need and have it happen</strong>, ActionChat is simpler, cheaper, and faster."
        highlight="Replace 50 Zaps with one conversation"
        highlightIcon={MessageSquare}
      />

      {/* Quick Stats */}
      <Section border={false}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="Chat" label="ActionChat UX" icon={MessageSquare} color="green" />
          <StatCard value="Free*" label="ActionChat + Your LLM" icon={DollarSign} color="green" />
          <StatCard value="Builder" label="Zapier UX" icon={Boxes} color="orange" />
          <StatCard value="$20-1000+/mo" label="Zapier Cost" icon={DollarSign} color="red" />
        </div>
      </Section>

      {/* Core Difference */}
      <Section border={false}>
        <TwoColumnCompare
          left={
            <FeatureBox
              icon={MousePointer}
              title="Zapier: Build Every Workflow"
              description="With Zapier, you manually configure every automation. Pick a trigger, pick an action, map the fields, test it, repeat for every use case."
              color="orange"
              items={[
                { good: false, text: "Build a new Zap for every workflow" },
                { good: false, text: "Map fields manually for each integration" },
                { good: false, text: "Debug when workflows break" },
                { good: false, text: "Manage dozens of Zaps over time" },
              ]}
            />
          }
          right={
            <FeatureBox
              icon={MessageSquare}
              title="ActionChat: Just Say It"
              description="With ActionChat, you describe what you want in plain English. No building, no field mapping, no maintenance."
              color="green"
              items={[
                { good: true, text: '"Refund order #992 for bob@example.com"' },
                { good: true, text: '"Cancel subscription for user 12345"' },
                { good: true, text: '"Move this user to the Enterprise org"' },
                { good: true, text: "Confirms before destructive actions" },
              ]}
            />
          }
        />
      </Section>

      {/* Quotes */}
      <Section>
        <SectionTitle
          title="What People Are Saying About Zapier"
          subtitle="Real feedback from G2, Capterra, and Trustpilot reviews."
        />
        <div className="grid md:grid-cols-2 gap-6">
          {QUOTES.map((q, i) => (
            <QuoteCard key={i} {...q} />
          ))}
        </div>
      </Section>

      {/* Hidden Cost of Tasks */}
      <Section>
        <SectionTitle
          title='The Hidden Cost of "Tasks"'
          subtitle="Zapier charges per task. Every step in every automation counts. It adds up fast."
        />

        <div className="p-8 bg-red-500/5 border border-red-500/20 rounded-2xl mb-8">
          <h3 className="text-lg font-bold text-red-400 mb-4">Real Example: Order Processing</h3>
          <p className="text-white/60 mb-4">
            A "simple" order workflow that updates inventory, sends a confirmation email, and logs to a spreadsheet uses <strong>9 tasks per order</strong>.
          </p>
          <div className="bg-black/20 rounded-lg p-4 font-mono text-sm">
            <div className="text-white/60">200 orders/day × 9 tasks × 30 days = <span className="text-red-400 font-bold">54,000 tasks/month</span></div>
            <div className="text-white/40 mt-2">Zapier Professional (750 tasks): $19.99/mo</div>
            <div className="text-white/40">54,000 tasks: <span className="text-red-400">$500+/month</span></div>
          </div>
        </div>

        <TwoColumnCompare
          left={
            <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-red-400 mb-4">Zapier Pricing Reality</h3>
              <ul className="space-y-3">
                <li className="flex justify-between text-white/70"><span>Free Plan</span><span className="text-white/50">100 tasks, 2-step only</span></li>
                <li className="flex justify-between text-white/70"><span>Professional</span><span className="text-white/50">$19.99/mo for 750 tasks</span></li>
                <li className="flex justify-between text-white/70"><span>Team</span><span className="text-white/50">$69/mo for 2,000 tasks</span></li>
                <li className="flex justify-between text-white/70"><span>Enterprise</span><span className="text-white/50">$$$$ (custom pricing)</span></li>
                <li className="flex justify-between text-white/70"><span>Extra tasks</span><span className="text-white/50">$49.99 per 750</span></li>
              </ul>
            </div>
          }
          right={
            <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-green-400 mb-4">ActionChat Pricing</h3>
              <ul className="space-y-3">
                <li className="flex justify-between text-white/70"><span>Self-Hosted</span><span className="text-green-400">Free forever</span></li>
                <li className="flex justify-between text-white/70"><span>Unlimited "tasks"</span><span className="text-green-400">Yes</span></li>
                <li className="flex justify-between text-white/70"><span>Your LLM costs</span><span className="text-white/50">Pay as you go</span></li>
                <li className="flex justify-between text-white/70"><span>Typical monthly</span><span className="text-green-400">$5-20</span></li>
                <li className="flex justify-between text-white/70"><span>No per-task fees</span><span className="text-green-400">Ever</span></li>
              </ul>
            </div>
          }
        />
      </Section>

      {/* Feature Comparison */}
      <Section>
        <SectionTitle title="Feature Comparison" />
        <ComparisonTable usLabel="ActionChat" themLabel="Zapier">
          {COMPARISON_DATA.map((row, i) => (
            <ComparisonRow key={i} feature={row.feature} us={row.us} them={row.them} highlight={row.highlight} />
          ))}
        </ComparisonTable>
      </Section>

      {/* Different Tools */}
      <Section>
        <SectionTitle
          title="Different Tools for Different Jobs"
          subtitle="We're not saying Zapier is bad — it's great for certain use cases. Here's how to choose."
        />
        <TwoColumnCompare
          left={
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">Use ActionChat when...</h3>
              <ul className="space-y-3 text-white/70">
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Your team needs to do ad-hoc operations tasks</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You want human confirmation before destructive actions</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> Non-technical users need to execute API calls</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You need an audit trail of who did what</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You want to self-host for security/compliance</li>
              </ul>
            </div>
          }
          right={
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
              <h3 className="text-lg font-bold text-orange-400 mb-4">Use Zapier when...</h3>
              <ul className="space-y-3 text-white/70">
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> You need fully automated, unattended workflows</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> Workflows run on triggers (new email, new row, etc.)</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> You need specific app-to-app integrations</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> Budget isn't a primary concern</li>
                <li className="flex items-start gap-2"><Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" /> You prefer visual workflow building</li>
              </ul>
            </div>
          }
        />
      </Section>

      {/* Reliability */}
      <Section>
        <AlertBox icon={RefreshCw} title="Zapier Reliability Concerns" color="yellow">
          <p className="text-white/70 mb-4">According to user reviews, Zapier workflows can be fragile:</p>
          <ul className="space-y-2 text-white/60 text-sm">
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "When one step fails, the entire automation stops"</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "Randomly fail with 'rate limit exceeded' errors"</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "Stop working when authentication tokens expire, often without notification"</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "Dashboards become cluttered with dozens of Zaps"</li>
          </ul>
          <p className="text-white/50 text-sm mt-4">
            ActionChat is request-based — you initiate actions when you need them. No background workflows to break.
          </p>
        </AlertBox>
      </Section>

      <CompareCTA
        title="Stop building Zaps. Start chatting."
        subtitle="ActionChat is free, open source, and takes 2 minutes to set up. No per-task fees. Ever."
      />

      <SourcesSection sources={SOURCES} />
    </CompareLayout>
  );
}
