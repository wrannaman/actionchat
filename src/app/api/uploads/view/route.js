import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { generatePresignedGetUrl } from '@/lib/s3'

// POST /api/uploads/view - Get presigned view URLs for files
// All files are private - this generates temporary signed URLs
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    const orgId = orgMember?.org_id

    const body = await request.json()
    const { keys } = body

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ error: 'keys array is required' }, { status: 400 })
    }

    if (keys.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 keys per request' }, { status: 400 })
    }

    // Generate view URLs
    const urlEntries = await Promise.all(
      keys.map(async (key) => {
        try {
          // Security check: key should contain user or org path
          const isUserFile = key.includes(`user/${user.id}`)
          const isOrgFile = orgId && key.includes(`org/${orgId}`)

          if (!isUserFile && !isOrgFile) {
            console.warn(`[UPLOADS/VIEW] Access denied to key: ${key}`)
            return [key, null]
          }

          const url = await generatePresignedGetUrl(key)
          return [key, url]
        } catch (err) {
          console.error(`[UPLOADS/VIEW] Failed to get URL for ${key}:`, err)
          return [key, null]
        }
      })
    )

    const urls = Object.fromEntries(urlEntries.filter(([, url]) => url !== null))

    return NextResponse.json({
      ok: true,
      urls,
    })
  } catch (error) {
    console.error('[UPLOADS/VIEW] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
