import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { uploadImageToS3 } from '@/lib/s3';
import { randomUUID } from 'crypto';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get file details
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentType = file.type || 'application/octet-stream';
    const ext = file.name.split('.').pop() || 'bin';
    
    // Generate unique key
    const key = `evals/${user.id}/${randomUUID()}.${ext}`;
    
    // Upload to S3
    const url = await uploadImageToS3(buffer, key, contentType);
    
    // Determine asset type
    let assetType = 'url';
    if (contentType.startsWith('image/')) assetType = 'image';
    else if (contentType.startsWith('video/')) assetType = 'video';
    else if (contentType.startsWith('audio/')) assetType = 'audio';
    
    return NextResponse.json({ 
      url,
      type: assetType,
      filename: file.name,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

