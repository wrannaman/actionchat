"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { AuthenticatedNav } from "@/components/layout/authenticated-nav";
import { Settings, Zap, Bot, Users } from "lucide-react";

const settingsNav = [
  { href: "/settings", label: "General", icon: Settings, exact: true, description: "AI provider & model" },
  { href: "/settings/sources", label: "API Sources", icon: Zap, description: "Connected APIs" },
  { href: "/settings/agents", label: "Agents", icon: Bot, description: "Bot configurations" },
  { href: "/settings/team", label: "Team", icon: Users, description: "Members & invites" },
];

function SettingsLayout({ children }) {
  const pathname = usePathname();

  const isActive = (item) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <AuthenticatedNav />

      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-60 border-r border-white/5 min-h-[calc(100vh-65px)] shrink-0 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="p-5">
            <h2 className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-4">
              Settings
            </h2>
            <nav className="space-y-1">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      active
                        ? "bg-blue-500/10 text-white border border-blue-500/20"
                        : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                      active ? "bg-blue-500/20" : "bg-white/5 group-hover:bg-white/10"
                    }`}>
                      <Icon className={`w-4 h-4 ${active ? "text-blue-400" : "text-white/40 group-hover:text-white/60"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${active ? "text-white" : ""}`}>
                        {item.label}
                      </div>
                      <div className="text-[11px] text-white/30 truncate">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-3xl">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function SettingsLayoutWrapper({ children }) {
  return (
    <AuthGuard>
      <SettingsLayout>{children}</SettingsLayout>
    </AuthGuard>
  );
}
