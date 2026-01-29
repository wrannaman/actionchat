"use client";

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    // Redirect to /join/[token] which handles the actual join flow
    if (token) {
      router.replace(`/join/${token}`);
    } else {
      router.replace('/');
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AcceptInviteContent />
    </Suspense>
  );
}