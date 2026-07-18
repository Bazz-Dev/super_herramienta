/**
 * Read-only: inventario de objetos R2 bajo clients/justburger/ (archive + tickets).
 * Sirve para localizar informes técnicos históricos (pre "guardar en carpeta")
 * antes de vincularlos como ClientDocument.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/list-jb-r2-archive.ts
 */
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

async function listAll(prefix: string) {
  const out: { Key?: string; Size?: number }[] = []
  let token: string | undefined
  do {
    const res = await r2.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET!, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }))
    out.push(...(res.Contents ?? []))
    token = res.NextContinuationToken
  } while (token)
  return out
}

async function main() {
  const archive = await listAll('clients/justburger/archive/')
  const tickets = await listAll('clients/justburger/tickets/')

  console.log(`\n=== clients/justburger/archive/ — ${archive.length} objetos ===`)
  for (const o of archive) console.log(`  ${o.Key}  (${((o.Size ?? 0) / 1024).toFixed(1)} KB)`)

  const pdfsInTickets = tickets.filter(o => o.Key?.toLowerCase().endsWith('.pdf'))
  console.log(`\n=== clients/justburger/tickets/ — ${tickets.length} objetos totales, ${pdfsInTickets.length} PDFs ===`)
  for (const o of pdfsInTickets) console.log(`  ${o.Key}  (${((o.Size ?? 0) / 1024).toFixed(1)} KB)`)
}
main()
