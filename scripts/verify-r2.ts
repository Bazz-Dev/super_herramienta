/**
 * Verify R2 connectivity and list bucket contents.
 * Run: npx tsx --env-file=.env.production.local scripts/verify-r2.ts
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

const res = await r2.send(new ListObjectsV2Command({
  Bucket: process.env.R2_BUCKET!,
  MaxKeys: 100,
}))

console.log(`✅ R2 conectado — Bucket: ${process.env.R2_BUCKET}`)
console.log(`   Objetos: ${res.KeyCount ?? 0}`)
if (res.Contents?.length) {
  console.log('\n   Archivos existentes:')
  res.Contents.forEach(o => console.log(`   - ${o.Key} (${((o.Size ?? 0) / 1024).toFixed(1)} KB)`))
} else {
  console.log('   Bucket vacío — listo para recibir archivos.')
}
