import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateReportPdf } from '../../src/lib/reports/pdf.ts'
import { sampleReport } from '../../src/lib/reports/sample.ts'
import { rasterizePdfFirstPage } from '../../src/lib/pdf-rasterize.ts'

function isPng(buf: Buffer): boolean {
  return buf.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n'
}

test('rasterizePdfFirstPage: convierte la página 1 de un PDF real a PNG', { timeout: 60_000 }, async () => {
  const pdfBuf = await generateReportPdf(sampleReport)
  const png = await rasterizePdfFirstPage(new Uint8Array(pdfBuf))
  assert.ok(isPng(png), 'debe devolver un PNG válido')
  assert.ok(png.length > 0)
})
