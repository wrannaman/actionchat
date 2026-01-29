import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

// Helper function to send Slack notification for new users
async function notifySlackNewUser(email) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.log('[AUTH/CALLBACK] SLACK_WEBHOOK_URL not set, skipping Slack notification')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `🦙 New user signed up: ${email}`,
      }),
    })

    if (!response.ok) {
      console.error('[AUTH/CALLBACK] Slack notification failed', { status: response.status })
    } else {
      console.log('[AUTH/CALLBACK] Slack notification sent for new user', { email })
    }
  } catch (error) {
    console.error('[AUTH/CALLBACK] Error sending Slack notification', { error: error.message })
  }
}

// Block generic email providers from domain auto-join for security
const BLOCKED_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'outlook.co.uk',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'yandex.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'tutanota.com',
  'hey.com',
])

// POST handler for setting session from client-side hash tokens
export async function POST(request) {
  try {
    const { access_token, refresh_token } = await request.json()
    
    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 })
    }
    
    const response = NextResponse.json({ success: true })
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    
    // Set the session using the tokens
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    })
    
    if (error) {
      console.error('[AUTH/CALLBACK] POST setSession error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    if (data?.session?.user) {
      console.log('[AUTH/CALLBACK] POST session set for user:', data.session.user.email)
      
      // Ensure org setup for the user
      const user = data.session.user
      
      // Check if this is a new user (created within the last minute)
      if (user.created_at) {
        const createdAt = new Date(user.created_at)
        const now = new Date()
        const timeDiff = now.getTime() - createdAt.getTime()
        const isNewUser = timeDiff < 60000 // 1 minute in milliseconds
        
        if (isNewUser && user.email) {
          await notifySlackNewUser(user.email)
        }
      }
      const preferred_name = 
        (user.user_metadata && user.user_metadata.full_name) ||
        (user.email && user.email.split('@')[0]) ||
        'Personal'
      
      // Create service client for org operations
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE
      )

      // Check for domain auto-join (skip for generic email providers)
      let autoJoinedOrgId = null
      if (user.email) {
        const emailDomain = user.email.split('@')[1]?.toLowerCase()
        if (emailDomain && !BLOCKED_EMAIL_DOMAINS.has(emailDomain)) {
          const { data: matchingOrg } = await serviceClient
            .from('org')
            .select('id, name')
            .ilike('allowed_domain', emailDomain)
            .limit(1)
            .single()
          
          if (matchingOrg) {
            const { data: existingMember } = await serviceClient
              .from('org_members')
              .select('id')
              .eq('org_id', matchingOrg.id)
              .eq('user_id', user.id)
              .single()
            
            if (!existingMember) {
              const { data: newMember, error: joinError } = await serviceClient
                .from('org_members')
                .insert({
                  org_id: matchingOrg.id,
                  user_id: user.id,
                  role: 'member',
                })
                .select('id')
                .single()
              
              if (!joinError && newMember) {
                autoJoinedOrgId = matchingOrg.id
                console.log('[AUTH/CALLBACK] POST Domain auto-join successful', {
                  orgId: matchingOrg.id,
                  orgName: matchingOrg.name
                })
              }
            } else {
              autoJoinedOrgId = matchingOrg.id
            }
          }
        }
      }

      // Check if user already has an org membership (from invite or previous signup)
      let existingOrgId = autoJoinedOrgId
      if (!existingOrgId) {
        const { data: existingMembership } = await serviceClient
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()
        
        if (existingMembership) {
          existingOrgId = existingMembership.org_id
          console.log('[AUTH/CALLBACK] POST User already has org membership', { orgId: existingOrgId })
        }
      }

      // Only create personal org if user doesn't have any org yet
      let finalOrgId = existingOrgId
      if (!finalOrgId) {
        const { data: orgId, error: orgErr } = await supabase.rpc('ensure_current_user_org', {
          preferred_name,
        })
        if (!orgErr && orgId) {
          finalOrgId = orgId
          console.log('[AUTH/CALLBACK] POST Created personal org', { orgId })
        }
      }
      
      if (finalOrgId) {
        response.cookies.set('org_id', String(finalOrgId), {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        })
      }
    }
    
    return response
  } catch (error) {
    console.error('[AUTH/CALLBACK] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const next = url.searchParams.get('redirectTo') || '/sources'
    const code = url.searchParams.get('code')
    const token_hash = url.searchParams.get('token_hash')
    const type = url.searchParams.get('type')
    const token = url.searchParams.get('token')
    
    // Check for GPT OAuth flow
    const gptOAuth = url.searchParams.get('gpt_oauth')
    const gptClientId = url.searchParams.get('client_id')
    const gptRedirectUri = url.searchParams.get('redirect_uri')
    const gptState = url.searchParams.get('state')

    // Check for OAuth error response (user denied access, etc.)
    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')

    // Verbose logging for debugging auth callback flows
    console.log('[AUTH/CALLBACK] Incoming', {
      path: url.pathname,
      origin: url.origin,
      next,
      query: {
        code: !!code,
        token_hash: !!token_hash,
        type: type || null,
        token_prefixed: token ? (token.startsWith('pkce_') ? 'pkce_*' : 'present') : null,
        gptOAuth: gptOAuth || null,
        gptClientId: gptClientId || null,
        error: error || null,
      },
    })

    // Handle OAuth errors (e.g., user denied access)
    if (error) {
      console.log('[AUTH/CALLBACK] OAuth error received', { error, errorDescription })
      const loginUrl = new URL('/auth/login', url.origin)
      const params = new URLSearchParams()
      params.set('error', error)
      params.set('error_code', error)
      params.set('error_description', errorDescription || 'Authentication was cancelled or denied')
      loginUrl.hash = params.toString()
      return NextResponse.redirect(loginUrl)
    }

    // Log flow detection for debugging
    const isOAuthFlow = code && !type && !token_hash && !token
    const isMagicLinkFlow = (token_hash && type) || (token && type === 'magiclink') || (code && type)
    console.log('[AUTH/CALLBACK] Flow detection', {
      isOAuthFlow,
      isMagicLinkFlow,
      hasCode: !!code,
      hasTokenHash: !!token_hash,
      hasToken: !!token,
      type: type || null
    })

    // Prepare success redirect response now so we can attach cookies to it
    const successResponse = NextResponse.redirect(new URL(next, url.origin))

    // Helper to redirect to login with error details (hash so client can read)
    const redirectToLoginWithError = (error) => {
      const loginUrl = new URL('/auth/login', url.origin)
      const params = new URLSearchParams()
      const code = error?.code || error?.name || 'auth_error'
      const message = error?.message || 'Authentication failed'
      params.set('error', 'access_denied')
      params.set('error_code', code)
      params.set('error_description', message)
      loginUrl.hash = params.toString()
      return NextResponse.redirect(loginUrl)
    }

    // 1) Complete auth as the user (SSR client bound to this response's cookies)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              successResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    // Use the flow detection from above

    if (isOAuthFlow) {
      // Standard OAuth PKCE flow (Google, etc.)
      console.log('[AUTH/CALLBACK] Branch=OAuth PKCE → exchangeCodeForSession')
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[AUTH/CALLBACK] OAuth exchangeCodeForSession error', { code: error.code, message: error.message })
        return redirectToLoginWithError(error)
      }
    } else if (token_hash && type) {
      // Standard magic link with token_hash
      console.log('[AUTH/CALLBACK] Branch=magic link OTP → verifyOtp', { type })
      const { error } = await supabase.auth.verifyOtp({ type, token_hash })
      if (error) {
        console.error('[AUTH/CALLBACK] verifyOtp error', { code: error.code, message: error.message })
        return redirectToLoginWithError(error)
      }
    } else if (code && type) {
      // Magic link signup sometimes sends code with type instead of token_hash
      console.log('[AUTH/CALLBACK] Branch=magic link code → verifyOtp', { type })
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: code })
      if (error) {
        console.error('[AUTH/CALLBACK] magic link code verifyOtp error', { code: error.code, message: error.message })
        return redirectToLoginWithError(error)
      }
    } else if (token && type === 'magiclink') {
      // Fallback handling when Supabase sends ?token=pkce_* without token_hash
      const isPkceToken = token.startsWith('pkce_')
      console.log('[AUTH/CALLBACK] Branch=token fallback', { isPkceToken })
      if (isPkceToken) {
        const { error } = await supabase.auth.exchangeCodeForSession(token)
        if (error) {
          console.error('[AUTH/CALLBACK] fallback exchangeCodeForSession error', { code: error.code, message: error.message })
          return redirectToLoginWithError(error)
        }
      } else {
        const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: token })
        if (error) {
          console.error('[AUTH/CALLBACK] fallback verifyOtp error', { code: error.code, message: error.message })
          return redirectToLoginWithError(error)
        }
      }
    } else {
      // If no query params, check if this might be a magic link with hash params
      // Return an HTML page that can process hash parameters client-side
      console.log('[AUTH/CALLBACK] No query params, returning hash processor page')
      
      const htmlPage = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Processing Authentication...</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
              background: #fafafa;
            }
            .container { text-align: center; }
            .spinner { 
              border: 2px solid #f3f3f3;
              border-top: 2px solid #333;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <p id="status">Processing authentication...</p>
          </div>
          <script>
            async function processAuth() {
              const status = document.getElementById('status');

              try {
                // Check for auth tokens in URL hash
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);

                // Check for errors in hash first
                const error = params.get('error');
                if (error) {
                  // Redirect to login with error details
                  const loginUrl = new URL('/auth/login', window.location.origin);
                  loginUrl.hash = hash;
                  window.location.href = loginUrl.toString();
                  return;
                }

                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken && refreshToken) {
                  status.textContent = 'Setting up session...';

                  // Send tokens to server to set session cookies
                  const response = await fetch('/auth/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
                  });

                  if (response.ok) {
                    status.textContent = 'Success! Redirecting...';
                    // Check for stored redirect URL
                    let redirectUrl = '/sources';
                    try {
                      const stored = localStorage.getItem('auth_redirect_to');
                      if (stored) {
                        redirectUrl = stored;
                        localStorage.removeItem('auth_redirect_to');
                      }
                    } catch (e) {}
                    setTimeout(() => {
                      window.location.href = redirectUrl;
                    }, 500);
                  } else {
                    status.textContent = 'Authentication failed';
                    setTimeout(() => { window.location.href = '/auth/login'; }, 2000);
                  }
                } else {
                  // No tokens and no error - redirect to login
                  window.location.href = '/auth/login';
                }
              } catch (error) {
                status.textContent = 'Error: ' + error.message;
                console.error('Auth processing error:', error);
                setTimeout(() => { window.location.href = '/auth/login'; }, 2000);
              }
            }
            
            processAuth();
          </script>
        </body>
        </html>
      `;
      
      return new Response(htmlPage, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // 2) Ensure org idempotently (SECURITY DEFINER RPC) and set cookie
    const { data: userRes, error: getUserError } = await supabase.auth.getUser()
    if (getUserError) {
      console.error('[AUTH/CALLBACK] getUser error', { code: getUserError.code, message: getUserError.message })
    }
    const user = userRes?.user
    if (!user) {
      console.warn('[AUTH/CALLBACK] No user after auth exchange')
      return redirectToLoginWithError({ code: 'no_user', message: 'No user in session' })
    }
    console.log('[AUTH/CALLBACK] Authenticated user', { user_id: user.id, email: user.email })

    // Check if this is a new user (created within the last minute)
    if (user.created_at) {
      const createdAt = new Date(user.created_at)
      const now = new Date()
      const timeDiff = now.getTime() - createdAt.getTime()
      const isNewUser = timeDiff < 60000 // 1 minute in milliseconds
      
      if (isNewUser && user.email) {
        await notifySlackNewUser(user.email)
      }
    }

    const preferred_name =
      (user.user_metadata && user.user_metadata.full_name) ||
      (user.email && user.email.split('@')[0]) ||
      'Personal'

    // Create service client for admin operations (bypasses RLS)
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    )

    // Check for domain auto-join before ensuring org (skip for generic email providers)
    let autoJoinedOrgId = null
    if (user.email) {
      const emailDomain = user.email.split('@')[1]?.toLowerCase()
      if (emailDomain && !BLOCKED_EMAIL_DOMAINS.has(emailDomain)) {
        
        // Find org with matching allowed_domain
        const { data: matchingOrg } = await serviceClient
          .from('org')
          .select('id, name')
          .ilike('allowed_domain', emailDomain)
          .limit(1)
          .single()
        
        if (matchingOrg) {
          // Check if user is already a member
          const { data: existingMember } = await serviceClient
            .from('org_members')
            .select('id')
            .eq('org_id', matchingOrg.id)
            .eq('user_id', user.id)
            .single()
          
          if (!existingMember) {
            // Add user to org
            const { data: newMember, error: joinError } = await serviceClient
              .from('org_members')
              .insert({
                org_id: matchingOrg.id,
                user_id: user.id,
                role: 'member',
              })
              .select('id')
              .single()
            
            if (!joinError && newMember) {
              autoJoinedOrgId = matchingOrg.id
              console.log('[AUTH/CALLBACK] Domain auto-join successful', {
                orgId: matchingOrg.id,
                orgName: matchingOrg.name,
                domain: emailDomain
              })
            }
          } else {
            // Already a member, use this org
            autoJoinedOrgId = matchingOrg.id
          }
        }
      }
    }

    // Check if user already has an org membership (from invite, auto-join, or previous signup)
    let existingOrgId = autoJoinedOrgId;
    if (!existingOrgId) {
      const { data: existingMembership } = await serviceClient
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      
      if (existingMembership) {
        existingOrgId = existingMembership.org_id;
        console.log('[AUTH/CALLBACK] User already has org membership', { orgId: existingOrgId });
      }
    }

    // Only create a personal org if user doesn't have any org yet
    let finalOrgId = existingOrgId;
    if (!finalOrgId) {
      const { data: orgId, error: orgErr } = await supabase.rpc('ensure_current_user_org', {
        preferred_name,
      });
      if (orgErr || !orgId) {
        console.error('[AUTH/CALLBACK] ensure_current_user_org error', { message: orgErr?.message });
        return NextResponse.redirect(new URL('/error?code=org_init_failed', request.url));
      }
      console.log('[AUTH/CALLBACK] Created personal org', { orgId });
      finalOrgId = orgId;
    }


    successResponse.cookies.set('org_id', String(finalOrgId), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    // Handle GPT OAuth flow
    if (gptOAuth === 'true' && gptClientId && gptRedirectUri) {
      try {
        const { randomBytes } = await import('crypto')
        const authCode = randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        // Store the authorization code
        await supabase
          .from('gpt_oauth_codes')
          .insert({
            code: authCode,
            user_id: user.id,
            organization_id: finalOrgId,
            client_id: gptClientId,
            redirect_uri: gptRedirectUri,
            state: gptState || '',
            expires_at: expiresAt.toISOString(),
            used: false
          })

        // Redirect back to ChatGPT with the authorization code
        const gptCallback = new URL(gptRedirectUri)
        gptCallback.searchParams.set('code', authCode)
        if (gptState) gptCallback.searchParams.set('state', gptState)
        
        return NextResponse.redirect(gptCallback)
      } catch (error) {
        console.error('[AUTH/CALLBACK] GPT OAuth error:', error)
        // Fall through to normal success flow if GPT OAuth fails
      }
    }

    // Return page that checks localStorage for redirect URL (works for both email + Google login)
    const redirectHtml = `<!DOCTYPE html>
<html>
<head><title>Redirecting...</title></head>
<body>
<script>
(function() {
  var redirectUrl = '/sources';
  try {
    var stored = localStorage.getItem('auth_redirect_to');
    if (stored) {
      redirectUrl = stored;
      localStorage.removeItem('auth_redirect_to');
    }
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }
  window.location.replace(redirectUrl);
})();
</script>
</body>
</html>`
    const res = new Response(redirectHtml, { headers: { 'Content-Type': 'text/html' } })
    successResponse.cookies.getAll().forEach(c => res.headers.append('Set-Cookie', `${c.name}=${c.value}; Path=/; Max-Age=2592000; SameSite=Lax${c.httpOnly?'; HttpOnly':''}`))
    return res
  } catch (e) {
    const url = new URL(request.url)
    const loginUrl = new URL('/auth/login', url.origin)
    const params = new URLSearchParams()
    params.set('error', 'access_denied')
    params.set('error_code', e?.code || e?.name || 'auth_error')
    params.set('error_description', e?.message || 'Authentication failed')
    loginUrl.hash = params.toString()
    console.error('[AUTH/CALLBACK] Uncaught error', { code: e?.code || e?.name, message: e?.message })
    return NextResponse.redirect(loginUrl)
  }
}



