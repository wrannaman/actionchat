"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0a0f]">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/sources" className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight text-white">
              Action<span className="text-blue-400">Chat</span>
            </span>
          </Link>

          <div className="flex items-center gap-6 text-sm text-white/30">
            <Link href="/blog/sop-automation" className="hover:text-white transition-colors">
              SOP Automation
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/tos" className="hover:text-white transition-colors">
              Terms
            </Link>
            <a
              href="mailto:support@actionchat.io"
              className="hover:text-white transition-colors"
            >
              Contact
            </a>
          </div>

          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} ActionChat. MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
}
