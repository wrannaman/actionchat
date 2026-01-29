"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Loader2, Chrome } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const { loginWithMagicLink, loginWithGoogle, isAuthenticated } = useAuth();
  const router = useRouter();
  const emailInputRef = useRef(null);
  const [storedRedirect, setStoredRedirect] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRedirect = urlParams.get('redirectTo');
      const localStorageRedirect = localStorage.getItem('auth_redirect_to');
      const redirect = urlRedirect || localStorageRedirect;
      setStoredRedirect(redirect);

      if (urlRedirect && !localStorageRedirect) {
        localStorage.setItem('auth_redirect_to', urlRedirect);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      let redirectUrl = '/sources';
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('auth_redirect_to');
        if (stored) {
          redirectUrl = stored;
          localStorage.removeItem('auth_redirect_to');
        }
      }
      setTimeout(() => {
        router.push(redirectUrl);
      }, 100);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const hash = window.location.hash || '';
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const hashErrorDesc = hashParams.get('error_description');
      const hashErrorCode = hashParams.get('error_code');
      const hashError = hashParams.get('error');

      const qsParams = new URLSearchParams(window.location.search || '');
      const qsErrorDesc = qsParams.get('error_description');
      const qsErrorCode = qsParams.get('error_code');
      const qsError = qsParams.get('error');

      const message =
        hashErrorDesc || qsErrorDesc ||
        (hashErrorCode ? `${hashError || 'Authentication error'} (${hashErrorCode})` : null) ||
        (qsErrorCode ? `${qsError || 'Authentication error'} (${qsErrorCode})` : null) ||
        hashError || qsError;

      if (message) {
        setAuthError(message);
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      emailInputRef.current?.focus();
      return;
    }
    setIsMagicLinkLoading(true);
    try {
      await loginWithMagicLink(email);
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden relative">
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-cyan-400/10 rounded-full blur-[80px] pointer-events-none"></div>

      <header className="relative z-50 border-b border-white/5">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-white">
              Action<span className="text-blue-400">Chat</span>
            </h1>
          </Link>
          <Link href="/">
            <button className="text-white/50 hover:text-white transition-colors text-sm">
              &larr; Back
            </button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-20 md:py-32 relative">
        <div className="max-w-md mx-auto relative z-10">
          {authError && (
            <div className="mb-8 p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-sm">
              {authError}
            </div>
          )}

          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                Sign In
              </span>
            </h1>

            <p className="text-lg text-white/40">
              The anti-UI for internal operations
            </p>

            {storedRedirect && storedRedirect !== '/sources' && (
              <div className="mt-4 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                {storedRedirect.includes('/join/')
                  ? "Sign in to join the team. You'll be redirected back automatically."
                  : "Sign in to continue. You'll be redirected back automatically."}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Button
              size="lg"
              className="w-full text-lg px-8 py-7 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold shadow-2xl shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02]"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Chrome className="mr-3 h-5 w-5" />
                  Continue with Google
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 text-white/30">
                  or use email
                </span>
              </div>
            </div>

            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white/50">
                  Email
                </label>
                <Input
                  ref={emailInputRef}
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isMagicLinkLoading}
                  className="h-12 text-base bg-white/[0.03] border-white/10 text-white placeholder-white/30 focus:border-blue-400/50 focus:ring-blue-400/20"
                />
              </div>

              <Button
                type="submit"
                variant="ghost"
                className="w-full h-12 text-base font-medium bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-white/70 hover:text-white"
                disabled={isMagicLinkLoading}
              >
                {isMagicLinkLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-5 w-5" />
                    Send Magic Link
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-white/20 text-center pt-4">
              By continuing, you agree to our terms of service
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
