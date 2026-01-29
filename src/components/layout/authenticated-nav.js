"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavUser } from "./nav-user";

export function AuthenticatedNav() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/sources", label: "Sources" },
    { href: "/agents", label: "Agents" },
    { href: "/activity", label: "Activity" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className="border-b border-white/5 bg-[#0a0a0f]">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/sources" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              Action<span className="text-blue-400">Chat</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              link.disabled ? (
                <span
                  key={link.href}
                  className="text-sm font-medium text-white/25 cursor-not-allowed"
                >
                  {link.label}
                </span>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === link.href || pathname.startsWith(link.href + "/")
                      ? "text-blue-400"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}
          </nav>
        </div>
        <NavUser />
      </div>
    </header>
  );
}
