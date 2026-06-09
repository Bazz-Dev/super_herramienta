import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
  }

  const ext = EXT[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'Formato no soportado (PNG, JPG, WEBP, GIF).' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen supera 8 MB.' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const dir = path.join(process.cwd(), 'public', 'uploads')
  await mkdir(dir, { recursive: true })
  const filename = `${randomUUID()}${ext}`
  await writeFile(path.join(dir, filename), buffer)

  return NextResponse.json({ url: `/uploads/${filename}` })
}
