// Client-side image handling: turn a picked File into a compressed data URI.
//
// Why data URIs (not a server upload): on Vercel serverless the filesystem is
// read-only/ephemeral, so writing to public/uploads fails. Storing the image
// inline in the document data makes it work everywhere (preview iframe + PDF)
// with zero server storage. Images are downscaled + re-encoded so payloads and
// the generated PDF stay light even with a full photo annex.

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 12 * 1024 * 1024 // 12 MB raw input guard
const MAX_DIMENSION = 1600 // px, longest side after downscale
const JPEG_QUALITY = 0.82

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Imagen inválida'))
    img.src = src
  })
}

// Returns a data: URI. PNGs with transparency keep PNG; everything else is
// re-encoded as JPEG for size. GIFs are passed through untouched (animation).
export async function fileToDataUrl(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Formato no soportado (PNG, JPG, WEBP, GIF).')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('La imagen supera 12 MB.')
  }

  const raw = await readAsDataURL(file)
  if (file.type === 'image/gif') return raw

  // Downscale via canvas if larger than MAX_DIMENSION.
  const img = await loadImage(raw)
  const longest = Math.max(img.width, img.height)
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw // canvas unsupported — fall back to raw data URI

  // PNGs may have transparency; keep PNG. Others (incl. webp) → JPEG.
  const keepPng = file.type === 'image/png'
  if (!keepPng) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)

  return keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
