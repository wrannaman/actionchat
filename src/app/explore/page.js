"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  GitBranch,
  Search,
  ExternalLink,
  Zap,
  Server,
  Code,
  Star,
  Package,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

// Category icons mapping
const CATEGORY_ICONS = {
  payments: "CreditCard",
  communication: "MessageSquare",
  devops: "Server",
  project_management: "Ticket",
  crm: "Users",
  support: "MessageSquare",
  productivity: "Database",
  database: "Database",
  auth: "Shield",
  infrastructure: "Server",
  ecommerce: "ShoppingCart",
  system: "Terminal",
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

function IntegrationCard({ integration, onSelect }) {
  const isMcp = integration.type === "mcp";

  return (
    <div
      className="group relative p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all cursor-pointer"
      onClick={() => onSelect(integration)}
    >
      {/* Featured badge */}
      {integration.is_featured && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
          <Star className="w-3 h-3 text-yellow-500" />
          <span className="text-yellow-500 text-xs font-medium">Featured</span>
        </div>
      )}

      {/* Logo placeholder */}
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center mb-4 group-hover:from-white/10 group-hover:to-white/15 transition-colors">
        <span className="text-white/80 text-xl font-bold">{integration.name.charAt(0)}</span>
      </div>

      {/* Name and type badge */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-white font-bold text-lg">{integration.name}</h3>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            isMcp
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
          }`}
        >
          {isMcp ? "MCP" : "OpenAPI"}
        </span>
      </div>

      {/* Description */}
      <p className="text-white/50 text-sm mb-4 line-clamp-2">{integration.description}</p>

      {/* Use cases */}
      <div className="space-y-1.5 mb-4">
        {integration.use_cases.slice(0, 3).map((useCase, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-white/60 truncate">{useCase}</span>
          </div>
        ))}
        {integration.use_cases.length > 3 && (
          <span className="text-white/40 text-xs">+{integration.use_cases.length - 3} more</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <span className="text-white/40 text-xs capitalize">{integration.category.replace("_", " ")}</span>
        {integration.docs_url && (
          <a
            href={integration.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-cyan-400 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function IntegrationModal({ integration, onClose }) {
  if (!integration) return null;

  const isMcp = integration.type === "mcp";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0d0d12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center shrink-0">
              <span className="text-white/80 text-2xl font-bold">{integration.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-white font-bold text-xl">{integration.name}</h2>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isMcp
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {isMcp ? "MCP Server" : "OpenAPI"}
                </span>
              </div>
              <p className="text-white/60 text-sm">{integration.description}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Use Cases */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              What you can do
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {integration.use_cases.map((useCase, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 bg-white/[0.02] rounded-lg border border-white/5"
                >
                  <span className="text-white/70 text-sm">{useCase}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Details */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              Technical Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/5">
                <span className="text-white/50">Type</span>
                <span className="text-white/80">{isMcp ? "MCP Server" : "OpenAPI Spec"}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/5">
                <span className="text-white/50">Auth</span>
                <span className="text-white/80 capitalize">{integration.auth_type.replace("_", " ")}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/5">
                <span className="text-white/50">Category</span>
                <span className="text-white/80 capitalize">{integration.category.replace("_", " ")}</span>
              </div>
              {isMcp && integration.mcp_package && (
                <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/5">
                  <span className="text-white/50">Package</span>
                  <code className="text-cyan-400 text-xs">{integration.mcp_package}</code>
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          {integration.docs_url && (
            <div>
              <a
                href={integration.docs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                View Documentation
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex items-center justify-between">
          <Button variant="outline" onClick={onClose} className="bg-transparent border-white/20 text-white hover:bg-white/5">
            Close
          </Button>
          <Link href="/auth/login">
            <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
              Add to ActionChat
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function CategoryFilter({ categories, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={`px-4 py-2 rounded-full text-sm transition-all ${
          selected === null
            ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium"
            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`px-4 py-2 rounded-full text-sm transition-all ${
            selected === cat.id
              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}

function TypeFilter({ selected, onChange }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
          selected === null
            ? "bg-white/10 text-white"
            : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
        }`}
      >
        All Types
      </button>
      <button
        onClick={() => onChange("openapi")}
        className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
          selected === "openapi"
            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Server className="w-3.5 h-3.5" />
        OpenAPI
      </button>
      <button
        onClick={() => onChange("mcp")}
        className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
          selected === "mcp"
            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
            : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Package className="w-3.5 h-3.5" />
        MCP
      </button>
    </div>
  );
}

export default function ExplorePage() {
  const [integrations, setIntegrations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedIntegration, setSelectedIntegration] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/templates");
        const data = await res.json();
        if (data.ok) {
          setIntegrations(data.templates);
          setCategories(data.categories);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredIntegrations = useMemo(() => {
    let result = integrations;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(searchLower) ||
          i.description.toLowerCase().includes(searchLower) ||
          i.use_cases.some((uc) => uc.toLowerCase().includes(searchLower))
      );
    }

    if (selectedCategory) {
      result = result.filter((i) => i.category === selectedCategory);
    }

    if (selectedType) {
      result = result.filter((i) => i.type === selectedType);
    }

    // Sort: featured first, then alphabetical
    result.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [integrations, search, selectedCategory, selectedType]);

  const mcpCount = integrations.filter((i) => i.type === "mcp").length;
  const openapiCount = integrations.filter((i) => i.type === "openapi").length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-xl bg-[#0a0a0f]/80">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <TargetIcon className="w-8 h-8" />
            <span className="text-xl font-black tracking-tight">
              Action<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Chat</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <Link href="/explore" className="text-white font-medium">Explore</Link>
            <Link href="https://github.com/wrannaman/actionchat" target="_blank" className="hover:text-white transition-colors flex items-center gap-1">
              <GitBranch className="w-4 h-4" />
              GitHub
            </Link>
          </nav>
          <Link href="/auth/login">
            <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-black mb-4">
            Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Integrations</span>
          </h1>
          <p className="text-white/60 text-lg mb-2">
            Discover {integrations.length}+ APIs and MCP servers you can chat with
          </p>
          <p className="text-white/40 text-sm">
            {openapiCount} OpenAPI specs + {mcpCount} MCP servers. Add your own or use ours.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="max-w-5xl mx-auto mb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              type="text"
              placeholder="Search integrations, use cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 py-6 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-cyan-500/50"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onChange={setSelectedCategory}
            />
            <TypeFilter selected={selectedType} onChange={setSelectedType} />
          </div>
        </div>

        {/* Results count */}
        <div className="max-w-5xl mx-auto mb-6">
          <p className="text-white/40 text-sm">
            Showing {filteredIntegrations.length} integration{filteredIntegrations.length !== 1 ? "s" : ""}
            {search && ` for "${search}"`}
          </p>
        </div>

        {/* Integration Grid */}
        {loading ? (
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-xl animate-pulse">
                <div className="w-14 h-14 rounded-xl bg-white/5 mb-4" />
                <div className="h-6 w-32 bg-white/5 rounded mb-2" />
                <div className="h-4 w-full bg-white/5 rounded mb-4" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-white/5 rounded" />
                  <div className="h-3 w-3/4 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="max-w-5xl mx-auto text-center py-16">
            <p className="text-white/50 mb-4">No integrations found matching your criteria.</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setSelectedCategory(null);
                setSelectedType(null);
              }}
              className="bg-transparent border-white/20 text-white hover:bg-white/5"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onSelect={setSelectedIntegration}
              />
            ))}
          </div>
        )}

        {/* Call to action for adding integrations */}
        <div className="max-w-3xl mx-auto mt-16 p-8 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-white/5 rounded-2xl text-center">
          <h2 className="text-xl font-bold text-white mb-2">Have an API or MCP server?</h2>
          <p className="text-white/60 mb-6">
            ActionChat is the distribution platform for API-only and MCP-only products.
            Get your integration in front of thousands of users.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="https://github.com/wrannaman/actionchat" target="_blank">
              <Button className="bg-white/10 hover:bg-white/15 text-white border border-white/10">
                <GitBranch className="mr-2 h-4 w-4" />
                Submit via GitHub
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold">
                Add Your Own API
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 mt-16">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-3">
            <TargetIcon className="w-5 h-5" />
            <span>&copy; {new Date().getFullYear()} ActionChat. MIT License.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-white/50 transition-colors">Home</Link>
            <Link href="https://github.com/wrannaman/actionchat" target="_blank" className="hover:text-white/50 transition-colors">GitHub</Link>
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/tos" className="hover:text-white/50 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

      {/* Integration Modal */}
      {selectedIntegration && (
        <IntegrationModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
        />
      )}
    </div>
  );
}
