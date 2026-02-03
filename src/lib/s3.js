/**
 * S3 Storage Utility
 * Handles uploading and retrieving source content from S3
 * Using existing S3 configuration (Wasabi)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import moment from 'moment-timezone'

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || process.env.S3_HOST,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  signatureVersion: process.env.S3_SIGNATURE_VERSION || 'v4',
  tls: process.env.S3_SSL_ENABLED !== 'false',
});

const DEFAULT_BUCKET = process.env.S3_BUCKET || 'nocoio';

/**
 * Upload source content to S3
 * @param {string} content - The content to upload
 * @param {string} key - S3 object key (e.g., 'sources/briefing-id/source-id/item-id.txt')
 * @param {string} bucket - S3 bucket name (optional)
 * @returns {Promise<{bucket: string, key: string, size: number}>}
 */
export async function uploadToS3(content, key, bucket = DEFAULT_BUCKET) {
  try {
    const buffer = Buffer.from(content, 'utf-8');
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'text/plain; charset=utf-8',
      ServerSideEncryption: 'AES256', // Encrypt at rest
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    console.log(`[S3] Uploaded ${key} (${buffer.length} bytes)`);

    return {
      bucket,
      key,
      size: buffer.length,
    };
  } catch (error) {
    console.error(`[S3] Failed to upload ${key}:`, error);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Upload image to S3 with public read access
 * @param {Buffer|string} imageData - Image buffer or base64 string
 * @param {string} key - S3 object key (e.g., 'images/post-id.png')
 * @param {string} contentType - MIME type (e.g., 'image/png')
 * @param {string} bucket - S3 bucket name (optional)
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export async function uploadImageToS3(imageData, key, contentType = 'image/png', bucket = DEFAULT_BUCKET) {
  try {
    console.log(`[S3 IMAGE UPLOAD] Starting upload for key: ${key}`);
    console.log(`[S3 IMAGE UPLOAD] Content type: ${contentType}`);
    console.log(`[S3 IMAGE UPLOAD] Bucket: ${bucket}`);
    
    // Convert base64 to buffer if needed
    let buffer;
    if (typeof imageData === 'string' && imageData.startsWith('data:')) {
      const base64Data = imageData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
      console.log(`[S3 IMAGE UPLOAD] Converted data URL to buffer (${buffer.length} bytes)`);
    } else if (typeof imageData === 'string') {
      buffer = Buffer.from(imageData, 'base64');
      console.log(`[S3 IMAGE UPLOAD] Converted base64 string to buffer (${buffer.length} bytes)`);
    } else {
      buffer = imageData;
      console.log(`[S3 IMAGE UPLOAD] Using provided buffer (${buffer.length} bytes)`);
    }
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read', // Make images publicly accessible
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    console.log(`[S3 IMAGE UPLOAD] Uploading to: ${bucket}/${key}`);
    await s3Client.send(command);
    console.log(`[S3 IMAGE UPLOAD] ✓ Upload successful! ${buffer.length} bytes uploaded`);

    // Construct public URL for Wasabi (or other S3-compatible storage)
    const isPathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    const endpoint = process.env.S3_ENDPOINT || process.env.S3_HOST || `https://s3.${process.env.S3_REGION}.wasabisys.com`;
    
    console.log(`[S3 IMAGE UPLOAD] Endpoint: ${endpoint}`);
    console.log(`[S3 IMAGE UPLOAD] Path-style URL: ${isPathStyle}`);
    
    let publicUrl;
    if (isPathStyle) {
      // Path-style: https://s3.wasabisys.com/bucket/key
      publicUrl = `${endpoint}/${bucket}/${key}`;
    } else {
      // Virtual-hosted-style: https://bucket.s3.wasabisys.com/key
      const hostname = endpoint.replace('https://', '').replace('http://', '');
      publicUrl = `https://${bucket}.${hostname}/${key}`;
    }

    console.log(`[S3 IMAGE UPLOAD] ✓ Public URL generated: ${publicUrl}`);
    console.log(`[S3 IMAGE UPLOAD] ✓ Image is publicly accessible at the URL above`);

    return publicUrl;
  } catch (error) {
    console.error(`[S3 IMAGE UPLOAD] ✗ FAILED to upload image ${key}`);
    console.error(`[S3 IMAGE UPLOAD] Error details:`, error);
    console.error(`[S3 IMAGE UPLOAD] Error message:`, error.message);
    console.error(`[S3 IMAGE UPLOAD] Error stack:`, error.stack);
    throw new Error(`S3 image upload failed: ${error.message}`);
  }
}

/**
 * Download content from S3
 * @param {string} key - S3 object key
 * @param {string} bucket - S3 bucket name (optional)
 * @returns {Promise<string>} Content as string
 */
export async function downloadFromS3(key, bucket = DEFAULT_BUCKET) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    const content = await streamToString(response.Body);

    console.log(`[S3] Downloaded ${key}`);
    return content;
  } catch (error) {
    console.error(`[S3] Failed to download ${key}:`, error);
    throw new Error(`S3 download failed: ${error.message}`);
  }
}

/**
 * Generate S3 key for a source item
 * @param {string} briefingId - Briefing UUID
 * @param {string} sourceId - Source UUID
 * @param {string} itemId - Item UUID
 * @param {string} extension - File extension (default: 'txt')
 * @returns {string} S3 key
 */
export function generateS3Key(briefingId, sourceId, itemId, extension = 'txt') {
  const date = moment.utc().format('YYYY-MM-DD'); // YYYY-MM-DD
  return `sources/${briefingId}/${sourceId}/${date}/${itemId}.${extension}`;
}

/**
 * Helper: Convert stream to string
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Generate presigned URL for direct S3 upload (PUBLIC - objects are publicly accessible)
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type
 * @param {string} bucket - S3 bucket name (optional)
 * @param {number} expiresIn - Expiration time in seconds (default: 3600)
 * @returns {Promise<{presignedUrl: string, publicUrl: string}>}
 */
export async function generatePresignedUploadUrl(key, contentType, bucket = DEFAULT_BUCKET, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read', // Make objects publicly accessible
  });

  // Use conditions to ensure ACL is properly set (matches working pattern)
  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn,
    conditions: [
      { acl: 'public-read' },
      { bucket: bucket }
    ]
  });

  // Construct public URL (objects are publicly accessible with ACL)
  const isPathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
  const endpoint = process.env.S3_ENDPOINT || process.env.S3_HOST || `https://s3.${process.env.S3_REGION}.wasabisys.com`;

  let publicUrl;
  if (isPathStyle) {
    // Path-style: https://endpoint/bucket/key
    publicUrl = `${endpoint}/${bucket}/${key}`;
  } else {
    // Virtual-hosted-style: https://bucket.endpoint/key
    const endpointUrl = endpoint.startsWith('http') ? new URL(endpoint) : new URL(`https://${endpoint}`);
    const hostname = endpointUrl.host;
    publicUrl = `https://${bucket}.${hostname}/${key}`;
  }

  return { presignedUrl, publicUrl };
}

/**
 * Generate presigned URL for direct S3 upload (PRIVATE - requires signed URLs to access)
 * Use this for sensitive files that should not be publicly accessible.
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type
 * @param {string} bucket - S3 bucket name (optional)
 * @param {number} expiresIn - Expiration time in seconds (default: 3600)
 * @returns {Promise<{presignedUrl: string, key: string}>}
 */
export async function generatePrivateUploadUrl(key, contentType, bucket = DEFAULT_BUCKET, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    // No ACL = private by default
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return { presignedUrl, key };
}

/**
 * Generate presigned GET URL for accessing S3 objects
 * @param {string} key - S3 object key
 * @param {string} bucket - S3 bucket name (optional)
 * @param {number} expiresIn - Expiration time in seconds (default: 86400 = 24 hours)
 * @returns {Promise<string>} Presigned GET URL
 */
export async function generatePresignedGetUrl(key, bucket = DEFAULT_BUCKET, expiresIn = 86400) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return presignedUrl;
}

/**
 * Set ACL on an S3 object (useful after upload to ensure public access)
 * @param {string} key - S3 object key
 * @param {string} acl - ACL value (default: 'public-read')
 * @param {string} bucket - S3 bucket name (optional)
 * @returns {Promise<void>}
 */
export async function setObjectACL(key, acl = 'public-read', bucket = DEFAULT_BUCKET) {
  const { PutObjectAclCommand } = await import('@aws-sdk/client-s3');
  
  const command = new PutObjectAclCommand({
    Bucket: bucket,
    Key: key,
    ACL: acl,
  });

  await s3Client.send(command);
  console.log(`[S3] Set ACL ${acl} on ${key}`);
}

/**
 * Extract S3 key from a public URL
 * @param {string} url - Public S3 URL
 * @returns {string|null} S3 key or null if extraction fails
 */
export function extractS3KeyFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const isPathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    
    if (isPathStyle) {
      // Path-style: https://endpoint/bucket/key
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const bucketIndex = pathParts.indexOf(DEFAULT_BUCKET);
      if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
    } else {
      // Virtual-hosted-style: https://bucket.endpoint/key
      if (urlObj.hostname.startsWith(`${DEFAULT_BUCKET}.`)) {
        return urlObj.pathname.substring(1); // Remove leading slash
      }
    }
    
    // Fallback: try to extract from pathname by pattern matching
    const keyMatch = urlObj.pathname.match(/(?:pdfs|uploads|images|evals)\/[\w\-\.\/]+/);
    if (keyMatch) {
      return keyMatch[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting S3 key from URL:', error);
    // Fallback: try regex pattern matching
    const keyMatch = url.match(/(?:pdfs|uploads|images|evals)\/[\w\-\.\/]+/);
    return keyMatch ? keyMatch[0] : null;
  }
}

const s3Storage = {
  uploadToS3,
  uploadImageToS3,
  downloadFromS3,
  generateS3Key,
  generatePresignedUploadUrl,
  generatePrivateUploadUrl,
  generatePresignedGetUrl,
  extractS3KeyFromUrl,
};

export default s3Storage;

