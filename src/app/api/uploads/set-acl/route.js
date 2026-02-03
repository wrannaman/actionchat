import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { setObjectACL, extractS3KeyFromUrl } from '@/lib/s3'

// POST /api/upload/set-acl - Set ACL on an uploaded object to ensure public access
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { url } = body
    
    if (!url) {
      return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
    }

    // Extract S3 key from the URL
    const s3Key = extractS3KeyFromUrl(url)
    
    if (!s3Key) {
      return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 })
    }

    // Set ACL to public-read
    await setObjectACL(s3Key, 'public-read')

    return NextResponse.json({
      success: true,
      message: 'ACL set successfully'
    })
  } catch (error) {
    console.error('Error setting ACL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

