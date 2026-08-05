import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
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

/**
 * Generate a presigned URL for a direct browser→R2 PUT — el navegador sube
 * los bytes directo al bucket, sin pasar por la función serverless (evita el
 * límite de payload de la plataforma, ~4.5MB, confirmado en vivo el 2026-07-30
 * en /api/tickets/[id]/documents). Expiry corto: solo debe vivir el tiempo de
 * la subida, no un link para compartir. Requiere CORS configurado en el
 * bucket de R2 para el/los origen(es) de la app — ver docs/architecture/GAP_REGISTER.md.
 */
export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(r2, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), { expiresIn })
}

/** Download an object's full bytes from R2 — for server-side processing (e.g. building a ZIP). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const bytes = await res.Body!.transformToByteArray()
  return Buffer.from(bytes)
}

/** Returns true if an R2 key (not "inline" JSON storage, a legacy /uploads/ path, or an external URL). */
export function isR2Key(value: string): boolean {
  return value !== 'inline' && !value.startsWith('/') && !value.startsWith('http')
}

/**
 * Canonical folder prefix for a ticket's files in R2.
 * Pattern: clients/{clientSlug}/tickets/{ticketCode}
 * Scalable: adding Decathlon = clients/decathlon/tickets/DEC-001
 */
export function ticketFolderKey(clientSlug: string, ticketCode: string): string {
  return `clients/${clientSlug}/tickets/${ticketCode}`
}

/**
 * List all objects under a prefix in R2.
 * Returns array of { key, size, lastModified } for every object found.
 */
export async function listR2Objects(prefix: string): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const results: { key: string; size: number; lastModified: Date }[] = []
  let continuationToken: string | undefined

  do {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key) {
        results.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified ?? new Date(),
        })
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  return results
}
