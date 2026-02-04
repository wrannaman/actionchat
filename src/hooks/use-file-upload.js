/**
 * useFileUpload - Upload files to S3 via presigned URLs
 *
 * Usage:
 *   const { upload } = useFileUpload()
 *   const { key, url } = await upload(file)
 */

import { useCallback } from 'react'

export function useFileUpload() {
  const upload = useCallback(async (file) => {
    // 1. Get presigned URL from our API
    const presignRes = await fetch('/api/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
      }),
    })

    if (!presignRes.ok) {
      const errData = await presignRes.json().catch(() => ({}))
      throw new Error(errData.error || 'Failed to get upload URL')
    }

    const { presignedUrl, signedUrl, key } = await presignRes.json()

    // 2. Upload directly to S3
    const uploadRes = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })

    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.status}`)
    }

    return {
      key,
      url: signedUrl,
      name: file.name,
      contentType: file.type,
    }
  }, [])

  return { upload }
}
