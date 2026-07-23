import archiver from 'archiver'
import { getObjectBuffer, isR2Key } from '@/lib/r2'

/**
 * Builds a ZIP buffer from a list of R2 keys, giving each entry a
 * human-readable name (deduped if two documents would collide). Keys that
 * aren't real R2 objects (e.g. "inline" JSON storage) are silently skipped.
 */
export async function buildZipFromR2Keys(
  files: { key: string; baseName: string }[],
): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const chunks: Buffer[] = []
  archive.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', resolve)
    archive.on('error', reject)
  })

  const usedNames = new Set<string>()
  for (const file of files) {
    if (!isR2Key(file.key)) continue
    const buf = await getObjectBuffer(file.key).catch(() => null)
    if (!buf) continue
    const ext = file.key.split('.').pop()?.toLowerCase() ?? 'bin'
    let name = `${file.baseName}.${ext}`
    let i = 2
    while (usedNames.has(name)) { name = `${file.baseName} (${i}).${ext}`; i++ }
    usedNames.add(name)
    archive.append(buf, { name })
  }
  archive.finalize()
  await done

  return Buffer.concat(chunks)
}
