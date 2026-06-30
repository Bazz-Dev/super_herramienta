import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET!

/** Upload a file stream to R2. Returns the storage key. */
export async function uploadToR2(
  key: string,
  body: ReadableStream | Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body as never,
      ContentType: contentType,
    }),
  )
  return key
}

/** Delete an object from R2 by key. */
export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/**
 * Generate a presigned URL for downloading/viewing a file.
 * Default expiry: 1 hour. Suitable for in-app "Ver" / "Descargar" links.
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn })
}

/** Returns true if an R2 key (not a legacy /uploads/ path or external URL). */
export function isR2Key(value: string): boolean {
  return !value.startsWith('/') && !value.startsWith('http')
}

/**
 * Canonical folder prefix for a ticket's files in R2.
 * Pattern: clients/{clientSlug}/tickets/{ticketCode}
 * Scalable: adding Decathlon = clients/decathlon/tickets/DEC-001
 */
export function ticketFolderKey(clientSlug: string, ticketCode: string): string {
  return `clients/${clientSlug}/tickets/${ticketCode}`
}
