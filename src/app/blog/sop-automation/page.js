import Link from "next/link";
import { ArrowLeft, Check, AlertTriangle, FileText, Zap, Shield, Clock } from "lucide-react";

export const metadata = {
  title: "How AI Turns SOPs Into Enforceable Workflows - ActionChat",
  description: "Standard Operating Procedures fail because humans skip steps. Learn how AI-powered automation can enforce SOP compliance, reduce errors, and create audit trails automatically.",
  keywords: ["SOP automation", "AI SOP compliance", "standard operating procedures AI", "automate SOPs", "SOP enforcement", "operational compliance AI"],
  openGraph: {
    title: "How AI Turns SOPs Into Enforceable Workflows",
    description: "Standard Operating Procedures fail because humans skip steps. Learn how AI can enforce SOP compliance automatically.",
    type: "article",
    publishedTime: "2026-02-03",
  },
};

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

export default function SOPAutomationPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#0a0a0f]/80">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <TargetIcon className="w-8 h-8" />
            <span className="text-xl font-black tracking-tight">
              Action<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Chat</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <article>
          <header className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm mb-6">
              <FileText className="w-4 h-4" />
              Operations
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
              How AI Turns SOPs Into Enforceable Workflows
            </h1>
            <p className="text-xl text-white/60">
              Your Standard Operating Procedures are only as good as your team's adherence to them. Here's why AI changes that equation.
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert prose-headings:text-white prose-p:text-white/70 prose-li:text-white/70 prose-strong:text-white prose-a:text-cyan-400 max-w-none">
            
            <h2 id="the-sop-problem">The SOP Problem Nobody Talks About</h2>
            <p>
              Every operations team has a folder full of Standard Operating Procedures. Refund policies. 
              Escalation workflows. User migration checklists. They're meticulously written, approved by 
              leadership, and... largely ignored when things get busy.
            </p>
            <p>
              The problem isn't that your team is lazy. It's that SOPs are <em>documentation</em>, 
              not <em>enforcement</em>. When a support rep is handling their 50th ticket of the day, 
              they're not going to pull up a 12-step checklist. They're going to do what they remember, 
              which is usually 80% of the process.
            </p>
            <p>
              That 20% gap is where refunds go wrong, audit findings happen, and customer trust erodes.
            </p>

            <div className="not-prose my-8 p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-bold mb-2">The Real Cost of SOP Drift</h3>
                  <ul className="space-y-2 text-white/70 text-sm">
                    <li>• Inconsistent customer experiences across team members</li>
                    <li>• Audit failures when steps aren't documented</li>
                    <li>• Training new hires on "how we actually do it" vs. what's written</li>
                    <li>• No visibility into whether processes are being followed</li>
                  </ul>
                </div>
              </div>
            </div>

            <h2 id="documentation-vs-execution">Documentation vs. Execution: A Fundamental Gap</h2>
            <p>
              Traditional SOPs suffer from a fundamental architectural flaw: they separate 
              <strong> what should happen</strong> from <strong>what actually happens</strong>.
            </p>
            <p>
              Your SOP says "verify the order is within 30 days before processing a refund." 
              But there's nothing stopping someone from skipping that step. The SOP is a suggestion, 
              not a guardrail.
            </p>
            <p>
              This is why compliance teams end up doing post-hoc audits—sampling tickets to see 
              if procedures were followed. It's expensive, slow, and only catches problems after 
              they've already happened.
            </p>

            <h2 id="ai-as-execution-layer">AI as the Execution Layer</h2>
            <p>
              What if the SOP <em>was</em> the execution layer? Not documentation that humans 
              interpret, but actual logic that controls what actions are possible.
            </p>
            <p>
              This is what modern AI-powered operations tools enable. Instead of writing a 
              document that says "check order date, verify amount, confirm with customer, 
              process in Stripe," you configure an AI agent that:
            </p>

            <div className="not-prose my-8 grid gap-4">
              <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Validates Before Executing</h4>
                  <p className="text-white/60 text-sm">
                    The agent checks order date automatically. If it's outside the refund window, 
                    the action is blocked—not just discouraged.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Requires Confirmation for High-Risk Actions</h4>
                  <p className="text-white/60 text-sm">
                    Destructive operations like refunds or data deletions require explicit human 
                    approval before execution. No accidental clicks.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Creates an Immutable Audit Trail</h4>
                  <p className="text-white/60 text-sm">
                    Every action is logged with who requested it, what was confirmed, and what 
                    the system did. Audit-ready by default.
                  </p>
                </div>
              </div>
            </div>

            <h2 id="concrete-example">A Concrete Example: The Refund SOP</h2>
            <p>
              Let's make this concrete. Here's a typical refund SOP:
            </p>

            <div className="not-prose my-6 p-4 bg-white/5 border border-white/10 rounded-xl font-mono text-sm">
              <p className="text-white/40 mb-2">// Traditional SOP (documentation)</p>
              <ol className="space-y-1 text-white/70 list-decimal list-inside">
                <li>Look up the order in Stripe</li>
                <li>Verify purchase date is within 30 days</li>
                <li>Confirm refund amount matches original charge</li>
                <li>Check for previous refunds on this order</li>
                <li>Process refund in Stripe</li>
                <li>Log action in ticket system</li>
              </ol>
            </div>

            <p>
              With an AI execution layer, the operator simply says: <em>"Refund order #12345 for bob@example.com"</em>
            </p>
            <p>
              The agent automatically:
            </p>
            <ul>
              <li>Looks up the order and verifies it exists</li>
              <li>Checks the purchase date (blocks if outside policy)</li>
              <li>Shows the amount and asks for confirmation</li>
              <li>Executes the refund via the Stripe API</li>
              <li>Logs everything—who, what, when, outcome</li>
            </ul>
            <p>
              The SOP isn't a document anymore. It's <em>code</em>. And code doesn't skip steps.
            </p>

            <h2 id="beyond-refunds">Beyond Refunds: Where This Applies</h2>
            <p>
              The refund example is simple, but this pattern scales to any operational workflow:
            </p>
            <ul>
              <li><strong>User migrations:</strong> Move a user between organizations with all the required permission checks and data transfers</li>
              <li><strong>Account escalations:</strong> Ensure tier upgrades follow approval workflows</li>
              <li><strong>Data deletions:</strong> Enforce GDPR/CCPA compliance with mandatory confirmation steps</li>
              <li><strong>Subscription changes:</strong> Prorate correctly, notify the right systems, update billing</li>
            </ul>
            <p>
              Any process that currently lives in a wiki or runbook can become an enforceable 
              workflow with the right tooling.
            </p>

            <h2 id="implementation">How to Get Started</h2>
            <p>
              You don't need a massive digital transformation project. Start with one high-value workflow:
            </p>
            <ol>
              <li><strong>Pick your most painful SOP.</strong> The one that causes the most tickets, audit findings, or customer complaints.</li>
              <li><strong>Map the API calls.</strong> What systems does this workflow touch? Most modern SaaS tools have APIs.</li>
              <li><strong>Configure an AI agent.</strong> Tools like ActionChat let you connect APIs and define system prompts that encode your policies.</li>
              <li><strong>Roll out to a pilot team.</strong> Let them use natural language to execute the workflow. Collect feedback.</li>
              <li><strong>Iterate.</strong> Add more workflows as you prove value.</li>
            </ol>

            <div className="not-prose my-8 p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-cyan-500/20 rounded-xl">
              <div className="flex items-start gap-4">
                <Zap className="w-6 h-6 text-cyan-400 shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-bold mb-2">Try ActionChat</h3>
                  <p className="text-white/70 text-sm mb-4">
                    ActionChat is an open-source tool that turns any OpenAPI spec into a 
                    natural-language command center. Connect your APIs, define policies in 
                    plain English, and let your team execute workflows with built-in 
                    confirmation and audit trails.
                  </p>
                  <Link 
                    href="/auth/login" 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-lg hover:from-blue-400 hover:to-cyan-400 transition-colors"
                  >
                    Get Started Free
                  </Link>
                </div>
              </div>
            </div>

            <h2 id="the-future">The Future of SOPs</h2>
            <p>
              We're at an inflection point. For decades, operations teams have accepted that 
              SOPs are aspirational—guidelines that people mostly follow, with occasional drift 
              and errors.
            </p>
            <p>
              AI changes that calculus. When the SOP is the execution layer, compliance isn't 
              a training problem or an audit problem. It's just... how things work.
            </p>
            <p>
              The question isn't whether AI will transform operational workflows. It's whether 
              you'll be early or late to the shift.
            </p>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-3">
            <TargetIcon className="w-5 h-5" />
            <span>&copy; {new Date().getFullYear()} ActionChat. MIT License.</span>
          </div>
          <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2">
            <Link href="/" className="hover:text-white/50 transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/tos" className="hover:text-white/50 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
