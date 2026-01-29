import { updateSession } from '@/utils/supabase/middleware'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  console.log('🚀 ~ proxy ~ pathname:', request.nextUrl.pathname)
  
  // For API routes, attach org context
  if (request.nextUrl.pathname.startsWith('/api/')) {
    console.log('🚀 ~ proxy ~ processing API route')
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      console.log('🚀 ~ proxy ~ user:', user?.id)
      
      if (user) {
        // Get user's org ID and attach to headers
        const { data: orgMembership } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        console.log('🚀 ~ proxy ~ orgMembership:', orgMembership)
        
        if (orgMembership) {
          // Clone request and add org context to headers
          const requestHeaders = new Headers(request.headers)
          requestHeaders.set('x-user-org-id', orgMembership.org_id)
          requestHeaders.set('x-user-id', user.id)
          
          console.log('🚀 ~ proxy ~ setting headers:', {
            'x-user-org-id': orgMembership.org_id,
            'x-user-id': user.id
          })
          
          return NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
        }
      }
    } catch (error) {
      // If org lookup fails, continue without org context
      console.warn('Failed to attach org context:', error.message)
    }
  }
  
  // For non-API routes, use existing session update
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Include API routes now
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)',
  ],
}
