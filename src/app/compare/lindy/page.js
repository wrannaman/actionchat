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
  TrustpilotStars,
} from "@/components/compare";
import {
  DollarSign,
  Zap,
  AlertTriangle,
  Shield,
  Coins,
  Mail,
  Check,
  X,
} from "lucide-react";

// Page-specific content
const QUOTES = [
  {
    quote: "Somehow magically they decided to charge me 550 USD for using 44,000 credits. Whilst my monthly subscription is only 25 USD per month. And I never permitted overcharge for additional credits.",
    source: "Trustpilot, Jan 2026",
    issue: "$550 Surprise",
  },
  {
    quote: "Scammers - they keep charging after cancellation! I cancelled my subscription, but they continue to take payments from my account.",
    source: "Trustpilot User",
    issue: "Charged After Cancel",
  },
  {
    quote: "I got billed for a full year after I had cancelled my account inside the free trial period.",
    source: "Trustpilot User",
    issue: "Trial Trap",
  },
  {
    quote: "Agent consumed 5,000 credits in under 10 minutes without warning.",
    source: "Trustpilot User",
    issue: "Credit Burn",
  },
  {
    quote: "$34.99 charged after deleting their account. Support responded casually: 'No worries, you won't be charged again' — without proper investigation.",
    source: "Trustpilot User",
    issue: "Charged After Delete",
  },
  {
    quote: "I tried recreating my ultimate content system in Lindy AI, and it was a nightmare. I got constant errors and burned through my monthly credits trying to make it work.",
    source: "Substack Review",
    issue: "Wasted Credits",
  },
];

const COMPARISON_DATA = [
  { feature: "Pricing Model", us: "Free + LLM costs", them: "Credit-based", highlight: true },
  { feature: "Starting Price", us: "Free*", them: "$50/month", highlight: true },
  { feature: "Surprise Charges", us: "Impossible", them: "Common complaint", highlight: true },
  { feature: "Open Source", us: true, them: false, highlight: true },
  { feature: "Self-Hostable", us: true, them: false, highlight: true },
  { feature: "Trustpilot Rating", us: "N/A (new)", them: "2.6/5" },
  { feature: "Credit System", us: "None", them: "400-5000/month" },
  { feature: "Credits Roll Over", us: "N/A", them: false },
  { feature: "Human-in-the-Loop", us: true, them: "Limited", highlight: true },
  { feature: "Audit Trail", us: true, them: "Limited" },
  { feature: "Team Permissions", us: true, them: true },
  { feature: "API Integrations", us: "Any OpenAPI", them: "Pre-built only", highlight: true },
  { feature: "Cancel Anytime", us: "Nothing to cancel", them: "Issues reported" },
];

const SOURCES = [
  { url: "https://www.trustpilot.com/review/lindy.ai", label: "Trustpilot - Lindy AI Reviews" },
  { url: "https://www.g2.com/products/lindy-lindy/reviews", label: "G2 - Lindy Reviews" },
  { url: "https://annikahelendi.substack.com/p/my-honest-lindy-ai-review-what-works", label: "Honest Lindy Review (Substack)" },
  { url: "https://docs.lindy.ai/account-billing/credits", label: "Lindy Credits Documentation" },
  { url: "https://gmelius.com/blog/lindy-ai-personal-assistant-review", label: "Gmelius - Lindy Review" },
  { url: "https://10web.io/ai-tools/lindy-ai/", label: "10Web - Lindy Pros & Cons" },
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

export default function LindyComparison() {
  return (
    <CompareLayout currentPage="/compare/lindy">
      <CompareHero
        badge="Comparison"
        title={<>ActionChat vs Lindy AI<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Predictable vs. Credit Anxiety</span></>}
        subtitle="Lindy is a buzzy AI assistant, but users report billing nightmares and credit anxiety. ActionChat is <strong>free, open source, and predictable</strong>."
      />

      {/* Trustpilot Rating Callout */}
      <Section border={false} className="pb-0">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-4 px-6 py-3 bg-red-500/10 border border-red-500/20 rounded-full">
            <span className="text-white/60 text-sm">Lindy Trustpilot Rating:</span>
            <TrustpilotStars rating={2.6} />
          </div>
        </div>
      </Section>

      {/* Quick Stats */}
      <Section border={false}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="Free*" label="ActionChat + Your LLM" icon={DollarSign} color="green" />
          <StatCard value="No credits" label="Pay your LLM directly" icon={Zap} color="green" />
          <StatCard value="$50+/mo" label="Lindy Starting" icon={DollarSign} color="red" />
          <StatCard value="2.6/5" label="Lindy Trustpilot" icon={AlertTriangle} color="red" />
        </div>
      </Section>

      {/* Billing Horror Stories */}
      <Section>
        <SectionTitle
          title="Lindy Billing Horror Stories"
          subtitle="Real reviews from Trustpilot. These are actual customer experiences."
        />
        <div className="grid md:grid-cols-2 gap-6">
          {QUOTES.map((q, i) => (
            <QuoteCard key={i} {...q} />
          ))}
        </div>
      </Section>

      {/* Credit Anxiety */}
      <Section>
        <SectionTitle
          title="The Credit Anxiety Problem"
          subtitle="Lindy's credit system makes users afraid to actually use the product."
        />
        <TwoColumnCompare
          left={
            <FeatureBox
              icon={Coins}
              title="Lindy's Credit System"
              color="red"
              items={[
                { good: false, text: "Free plan: 400 credits/month (no premium actions)" },
                { good: false, text: "Paid plan: $50/month for 5,000 credits" },
                { good: false, text: "Credits do NOT roll over" },
                { good: false, text: "Extra credits: $10 per 1,000" },
                { good: false, text: "When you run out: agents pause" },
              ]}
            />
          }
          right={
            <FeatureBox
              icon={Shield}
              title="ActionChat's Model"
              color="green"
              items={[
                { good: true, text: "Self-host: completely free" },
                { good: true, text: "No credits, no limits" },
                { good: true, text: "Pay your LLM provider directly" },
                { good: true, text: "Predictable costs: $5-20/month typical" },
                { good: true, text: "No surprise charges. Ever." },
              ]}
            />
          }
        />
        <p className="text-center text-white/50 text-sm mt-6 italic">
          "The credit consumption makes me too anxious to use it with every random idea I have."
        </p>
      </Section>

      {/* Support Issues */}
      <Section>
        <AlertBox icon={Mail} title="Lindy Support Problems" color="yellow">
          <p className="text-white/70 mb-4">According to Trustpilot reviews, getting help from Lindy is difficult:</p>
          <ul className="space-y-2 text-white/60 text-sm">
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "Nowhere to contact support" — forced to use AI agents (which consume more credits)</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "Support didn't respond to emails despite multiple attempts"</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "Unsubscribed from their email list 15 times and still they keep going"</li>
            <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> "No response after spending $100 seeking assistance"</li>
          </ul>
          <p className="text-white/50 text-sm mt-4">
            ActionChat is open source — check the GitHub issues, read the code, or self-host and own your destiny.
          </p>
        </AlertBox>
      </Section>

      {/* Feature Comparison */}
      <Section>
        <SectionTitle title="Feature Comparison" />
        <ComparisonTable usLabel="ActionChat" themLabel="Lindy AI">
          {COMPARISON_DATA.map((row, i) => (
            <ComparisonRow key={i} feature={row.feature} us={row.us} them={row.them} highlight={row.highlight} />
          ))}
        </ComparisonTable>
      </Section>

      {/* TL;DR */}
      <Section>
        <div className="p-8 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-2xl">
          <h2 className="text-2xl font-black mb-4">TL;DR</h2>
          <TwoColumnCompare
            left={
              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-3">Choose ActionChat if:</h3>
                <ul className="space-y-2 text-white/70">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You want predictable, transparent pricing</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You need to self-host for security/compliance</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You want to connect your own APIs (OpenAPI)</li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> You value open source and community</li>
                </ul>
              </div>
            }
            right={
              <div>
                <h3 className="text-lg font-bold text-white/60 mb-3">Consider Lindy if:</h3>
                <ul className="space-y-2 text-white/50">
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You want pre-built integrations without setup</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You're okay with credit-based pricing</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You don't need to self-host</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 shrink-0" /> You're comfortable monitoring credit usage closely</li>
                </ul>
              </div>
            }
          />
        </div>
      </Section>

      {/* Use Cases */}
      <Section>
        <SectionTitle
          title="Built for Back-Office Teams"
          subtitle="Routine operations without credit anxiety."
        />
        <UseCaseGrid items={USE_CASES} />
        <p className="text-center text-white/40 mt-8 text-sm">
          Use it as much as you want. No credits. No anxiety. No surprises.
        </p>
      </Section>

      <CompareCTA
        title="No credits. No surprises. No anxiety."
        subtitle="ActionChat is free, open source, and takes 2 minutes to set up."
      />

      <SourcesSection sources={SOURCES} />
    </CompareLayout>
  );
}
