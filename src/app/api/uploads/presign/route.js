import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { generatePrivateUploadUrl, generatePresignedGetUrl } from '@/lib/s3'

// POST /api/upload/presigned - Get presigned URL for direct S3 upload
// Supports both user session auth and API key auth
export async function POST(request) {
  try {
    let userId = null
    let orgId = null
    
    // Try API key authentication first
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('X-Api-Key') || request.headers.get('X-API-Key')
    
    let apiKey = null
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.replace('Bearer ', '').trim()
    } else if (apiKeyHeader) {
      apiKey = apiKeyHeader.trim()
    }
    
    if (apiKey) {
      // API key authentication
      const supabase = await createServiceClient()
      
      // Find org by API key
      const { data: org, error: orgError } = await supabase
        .from('org')
        .select('id, name')
        .eq('api_key', apiKey)
        .single()

      if (orgError || !org) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
      }
      orgId = org.id

      // Get the first owner/admin user from the org
      const { data: orgMember, error: memberError } = await supabase
        .from('org_members')
        .select('user_id, role')
        .eq('org_id', org.id)
        .in('role', ['owner', 'admin'])
        .limit(1)
        .single()

      if (memberError || !orgMember) {
        return NextResponse.json({ error: 'No admin user found for organization' }, { status: 500 })
      }
      userId = orgMember.user_id
    } else {
      // Session authentication
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Use session auth or API key (Authorization: Bearer <key> or x-api-key header)' }, { status: 401 })
      }
      userId = user.id
      
      // Get user's org if available
      const { data: orgMember } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (orgMember) {
        orgId = orgMember.org_id
      }
    }

    const body = await request.json()
    const { fileName, contentType } = body
    
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName and contentType are required' }, { status: 400 })
    }

    // Validate file type
    const isPDF = contentType === 'application/pdf'
    const isImage = contentType.startsWith('image/')
    const isVideo = contentType.startsWith('video/')
    const isAudio = contentType.startsWith('audio/')
    const isText = contentType === 'text/plain' || contentType === 'text/markdown' || contentType === 'text/x-markdown' || contentType === 'text/csv'
    const isData = contentType === 'application/json' || contentType === 'text/csv'
    const isOffice = contentType === 'application/msword' ||
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      contentType === 'application/vnd.ms-excel' ||
      contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    if (!isImage && !isPDF && !isVideo && !isAudio && !isText && !isData && !isOffice) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = fileName.split('.').pop() || (isPDF ? 'pdf' : 'bin')
    
    // Use org_id in path if available, otherwise use user_id
    const pathPrefix = orgId ? `org/${orgId}` : `user/${userId}`
    
    // Determine folder based on content type
    let folder = 'uploads'
    if (isPDF) folder = 'pdfs'
    else if (isImage) folder = 'images'
    else if (isVideo) folder = 'videos'
    else if (isAudio) folder = 'audio'
    else if (isText) folder = 'text'
    else if (isData) folder = 'data'
    else if (isOffice) folder = 'docs'
    
    const s3Key = `actionchat/${pathPrefix}/${folder}/${timestamp}-${randomString}.${fileExtension}`

    // Generate presigned URLs
    const { presignedUrl } = await generatePrivateUploadUrl(s3Key, contentType)
    const signedUrl = await generatePresignedGetUrl(s3Key)

    return NextResponse.json({ presignedUrl, signedUrl, key: s3Key })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

