// Generate PWA icons using Canvas API
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(iconsDir, { recursive: true })

function drawIcon(size, maskable = false) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const pad = maskable ? size * 0.1 : 0

  // Background
  ctx.fillStyle = '#111111'
  ctx.fillRect(0, 0, size, size)

  // Brand circle
  const cx = size / 2, cy = size / 2
  const r = (size / 2) - pad - size * 0.04
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#f5b100'
  ctx.fill()

  // "I" letter — bold, centered
  ctx.fillStyle = '#111111'
  ctx.font = `bold ${Math.round(r * 1.1)}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('I', cx, cy)

  // Dot
  const dotR = r * 0.15
  ctx.beginPath()
  ctx.arc(cx + r * 0.32, cy - r * 0.38, dotR, 0, Math.PI * 2)
  ctx.fillStyle = '#111111'
  ctx.fill()

  return canvas.toBuffer('image/png')
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
for (const s of sizes) {
  writeFileSync(join(iconsDir, `icon-${s}.png`), drawIcon(s))
  console.log(`✓ icon-${s}.png`)
}
writeFileSync(join(iconsDir, 'icon-maskable-512.png'), drawIcon(512, true))
console.log('✓ icon-maskable-512.png')

// Badge (72px, monochrome)
const badge = createCanvas(72, 72)
const bc = badge.getContext('2d')
bc.fillStyle = '#f5b100'
bc.beginPath()
bc.arc(36, 36, 32, 0, Math.PI * 2)
bc.fill()
bc.fillStyle = '#111'
bc.font = 'bold 32px Arial'
bc.textAlign = 'center'
bc.textBaseline = 'middle'
bc.fillText('I', 36, 36)
writeFileSync(join(iconsDir, 'badge-72.png'), badge.toBuffer('image/png'))
console.log('✓ badge-72.png')

console.log('\nAll icons generated in public/icons/')
