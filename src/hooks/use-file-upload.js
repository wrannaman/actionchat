/**
 * useFileUpload - Hook for uploading files to S3 via presigned URLs
 *
 * Usage:
 *   const { upload, uploading, error } = useFileUpload()
 *
 *   const result = await upload(file)
 *   // result = { key, url, type }
 */

import { useState, useCallback } from 'react'

export function useFileUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)

  /**
   * Upload a single file to S3
   * @param {File} file - The file to upload
   * @returns {Promise<{key: string, url: string, type: string, name: string}>}
   */
  const upload = useCallback(async (file) => {
    setError(null)
    setUploading(true)
    setProgress(0)

    try {
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

      const { presignedUrl, signedUrl, key, type } = await presignRes.json()

      // 2. Upload directly to S3 using the presigned URL (private upload - no ACL header)
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`)
      }

      setProgress(100)

      return {
        key,
        url: signedUrl, // Signed URL for viewing (expires in 24h)
        type,
        name: file.name,
        size: file.size,
        contentType: file.type,
      }
    } catch (err) {
      console.error('[useFileUpload] Error:', err)
      setError(err.message)
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  /**
   * Upload multiple files in parallel
   * @param {File[]} files - Array of files to upload
   * @returns {Promise<Array<{key: string, url: string, type: string, name: string}>>}
   */
  const uploadMultiple = useCallback(async (files) => {
    setError(null)
    setUploading(true)
    setProgress(0)

    try {
      const results = await Promise.all(
        files.map(async (file, index) => {
          const result = await upload(file)
          setProgress(Math.round(((index + 1) / files.length) * 100))
          return result
        })
      )

      return results
    } catch (err) {
      console.error('[useFileUpload] Multiple upload error:', err)
      setError(err.message)
      throw err
    } finally {
      setUploading(false)
    }
  }, [upload])

  /**
   * Get signed view URL for a file key
   * @param {string} key - S3 key
   * @returns {Promise<string>} Signed URL
   */
  const getViewUrl = useCallback(async (key) => {
    const res = await fetch('/api/uploads/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: [key] }),
    })

    if (!res.ok) {
      throw new Error('Failed to get view URL')
    }

    const { urls } = await res.json()
    return urls[key]
  }, [])

  /**
   * Get signed view URLs for multiple file keys
   * @param {string[]} keys - Array of S3 keys
   * @returns {Promise<{[key: string]: string}>} Map of key -> signed URL
   */
  const getViewUrls = useCallback(async (keys) => {
    if (!keys || keys.length === 0) return {}

    const res = await fetch('/api/uploads/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    })

    if (!res.ok) {
      throw new Error('Failed to get view URLs')
    }

    const { urls } = await res.json()
    return urls
  }, [])

  return {
    upload,
    uploadMultiple,
    getViewUrl,
    getViewUrls,
    uploading,
    progress,
    error,
  }
}
