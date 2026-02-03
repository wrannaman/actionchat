"use client";

import { Check, X, Quote, ExternalLink, Zap } from "lucide-react";

// Reusable comparison table row
export function ComparisonRow({ feature, us, them, highlight = false }) {
  return (
    <div className={`grid grid-cols-3 gap-4 py-4 border-b border-white/5 ${highlight ? 'bg-green-500/5' : ''}`}>
      <div className="text-white/80 font-medium">{feature}</div>
      <div className="flex items-center gap-2">
        {typeof us === 'boolean' ? (
          us ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : (
            <X className="w-5 h-5 text-red-400" />
          )
        ) : (
          <span className="text-green-400">{us}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {typeof them === 'boolean' ? (
          them ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : (
            <X className="w-5 h-5 text-red-400" />
          )
        ) : (
          <span className="text-white/60">{them}</span>
        )}
      </div>
    </div>
  );
}

// Quote card for testimonials/complaints
export function QuoteCard({ quote, source, issue }) {
  return (
    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
      <div className="flex gap-3">
        <Quote className="w-6 h-6 text-red-400 shrink-0 mt-1" />
        <div>
          <p className="text-white/80 italic mb-3">&ldquo;{quote}&rdquo;</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/40">{source}</span>
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">{issue}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card for quick comparisons
const COLOR_CLASSES = {
  cyan: "from-cyan-500/10 to-blue-500/10 border-cyan-500/20",
  green: "from-green-500/10 to-emerald-500/10 border-green-500/20",
  red: "from-red-500/10 to-orange-500/10 border-red-500/20",
  orange: "from-orange-500/10 to-yellow-500/10 border-orange-500/20",
  yellow: "from-yellow-500/10 to-orange-500/10 border-yellow-500/20",
};

const ICON_COLOR_CLASSES = {
  cyan: "text-cyan-400",
  green: "text-green-400",
  red: "text-red-400",
  orange: "text-orange-400",
  yellow: "text-yellow-400",
};

export function StatCard({ value, label, icon: Icon, color = "cyan" }) {
  return (
    <div className={`p-6 bg-gradient-to-br ${COLOR_CLASSES[color]} border rounded-xl text-center`}>
      <Icon className={`w-8 h-8 mx-auto mb-3 ${ICON_COLOR_CLASSES[color]}`} />
      <div className="text-2xl font-black text-white mb-1">{value}</div>
      <div className="text-sm text-white/60">{label}</div>
    </div>
  );
}

// Hero section
export function CompareHero({ badge, title, subtitle, highlight, highlightIcon: HighlightIcon = Zap }) {
  return (
    <section className="container mx-auto px-6 pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm mb-6">
          <Zap className="w-4 h-4" />
          {badge || "Comparison"}
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-[1.1]">
          {title}
        </h1>

        <p className="text-xl text-white/60 mb-4 max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: subtitle }} />

        {highlight && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 font-bold mb-8">
            <HighlightIcon className="w-5 h-5" />
            {highlight}
          </div>
        )}
      </div>
    </section>
  );
}

// Comparison table wrapper
export function ComparisonTable({ usLabel, themLabel, children }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 md:p-8">
      {/* Header */}
      <div className="grid grid-cols-3 gap-4 pb-4 border-b border-white/10 mb-4">
        <div className="text-white/40 text-sm font-medium">Feature</div>
        <div className="text-cyan-400 font-bold">{usLabel || "ActionChat"}</div>
        <div className="text-white/60 font-bold">{themLabel}</div>
      </div>
      {children}
    </div>
  );
}

// Sources section
export function SourcesSection({ sources }) {
  return (
    <section className="container mx-auto px-6 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
          <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-4">Sources</h3>
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            {sources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-cyan-400 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> {source.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// CTA section
export function CompareCTA({ title, subtitle }) {
  return (
    <section className="container mx-auto px-6 py-20 border-t border-white/5">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-black mb-4">
          {title}
        </h2>
        <p className="text-white/50 mb-8">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="/auth/login">
            <button className="text-lg px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold shadow-xl shadow-blue-500/20 rounded-lg flex items-center gap-2">
              Get Started Free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </a>
          <a href="https://github.com/wrannaman/actionchat" target="_blank">
            <button className="text-lg px-8 py-4 bg-transparent border border-white/20 text-white hover:bg-white/5 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              View on GitHub
            </button>
          </a>
        </div>
      </div>
    </section>
  );
}

// Section wrapper with optional border
export function Section({ children, className = "", border = true }) {
  return (
    <section className={`container mx-auto px-6 py-16 ${border ? 'border-t border-white/5' : ''} ${className}`}>
      <div className="max-w-4xl mx-auto">
        {children}
      </div>
    </section>
  );
}

// Section title
export function SectionTitle({ title, subtitle }) {
  return (
    <>
      <h2 className="text-2xl md:text-3xl font-black mb-4 text-center">{title}</h2>
      {subtitle && <p className="text-white/50 text-center mb-12 max-w-2xl mx-auto">{subtitle}</p>}
    </>
  );
}

// Two column comparison boxes
export function TwoColumnCompare({ left, right }) {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      {left}
      {right}
    </div>
  );
}

// Feature box (used in TwoColumnCompare)
export function FeatureBox({ title, description, items, icon: Icon, color = "green" }) {
  const bgColors = {
    green: "from-green-500/5 to-cyan-500/5 border-green-500/20",
    red: "from-red-500/5 to-orange-500/5 border-red-500/20",
    orange: "from-orange-500/5 to-red-500/5 border-orange-500/20",
    blue: "from-blue-500/5 to-cyan-500/5 border-blue-500/20",
  };

  const iconBgColors = {
    green: "bg-green-500/10",
    red: "bg-red-500/10",
    orange: "bg-orange-500/10",
    blue: "bg-blue-500/10",
  };

  const iconColors = {
    green: "text-green-400",
    red: "text-red-400",
    orange: "text-orange-400",
    blue: "text-blue-400",
  };

  const titleColors = {
    green: "text-green-400",
    red: "text-red-400",
    orange: "text-orange-400",
    blue: "text-blue-400",
  };

  return (
    <div className={`p-8 bg-gradient-to-br ${bgColors[color]} border rounded-2xl`}>
      <div className={`w-12 h-12 rounded-xl ${iconBgColors[color]} flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${iconColors[color]}`} />
      </div>
      <h3 className={`text-xl font-bold ${titleColors[color]} mb-3`}>{title}</h3>
      {description && <p className="text-white/60 mb-4">{description}</p>}
      {items && (
        <ul className="space-y-2 text-white/50 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              {item.good ? (
                <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              ) : (
                <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Alert/callout box
export function AlertBox({ icon: Icon, title, children, color = "yellow" }) {
  const colors = {
    yellow: "from-yellow-500/5 to-orange-500/5 border-yellow-500/20",
    red: "from-red-500/5 to-orange-500/5 border-red-500/20",
    green: "from-green-500/5 to-cyan-500/5 border-green-500/20",
  };

  const iconColors = {
    yellow: "text-yellow-400",
    red: "text-red-400",
    green: "text-green-400",
  };

  const titleColors = {
    yellow: "text-yellow-400",
    red: "text-red-400",
    green: "text-green-400",
  };

  return (
    <div className={`p-8 bg-gradient-to-br ${colors[color]} border rounded-2xl`}>
      <div className="flex items-start gap-4">
        <Icon className={`w-8 h-8 ${iconColors[color]} shrink-0`} />
        <div>
          <h3 className={`text-xl font-bold ${titleColors[color]} mb-3`}>{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

// Use case grid
export function UseCaseGrid({ items }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((action, i) => (
        <div key={i} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400 shrink-0" />
          <span className="text-white/80">{action}</span>
        </div>
      ))}
    </div>
  );
}

// Trustpilot stars display
export function TrustpilotStars({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-5 h-5 ${star <= Math.floor(rating) ? 'text-red-400' : star - 0.5 <= rating ? 'text-red-400' : 'text-white/20'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-2 text-white/60 text-sm">{rating}/5</span>
    </div>
  );
}
