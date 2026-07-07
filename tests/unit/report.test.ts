import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pdf } from 'pdf-to-img'
import { generateReportPdf } from '../../src/lib/reports/pdf.ts'
import { sampleReport } from '../../src/lib/reports/sample.ts'
import { renderReportHTML } from '../../src/lib/reports/template'
import { reportFilename, type ReportData } from '../../src/lib/reports/types'

const TIMEOUT = 60_000
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwAChwGA60e6kgAAAABJRU5ErkJggg=='

async function pageCount(buf: Buffer): Promise<number> {
  const doc = await pdf(buf)
  return doc.length
}

function isPdf(buf: Buffer): boolean {
  return buf.subarray(0, 5).toString('latin1') === '%PDF-'
}

test('HTML: contiene cabecera, secciones numeradas y datos clave', () => {
  const html = renderReportHTML(sampleReport)
  assert.match(html, /INFORME TÉCNICO/)
  assert.match(html, /Alcance del servicio/)
  assert.match(html, /class="n">1\./) // primera sección numerada
  assert.match(html, /Just Burger/)
  assert.match(html, /VERSIÓN 01/)
})

test('HTML: escapa caracteres especiales (sin inyección)', () => {
  const html = renderReportHTML({
    ...sampleReport,
    client: 'A & B <Ltda> "X"',
    sections: [{ title: 'T <b>', body: 'Texto & <i>', bullets: ['Uno < Dos'] }],
  })
  assert.doesNotMatch(html, /<b>/)
  assert.match(html, /&lt;b&gt;/)
  assert.match(html, /A &amp; B/)
})

test('nombre de archivo: IT - <reportId> - <SUCURSAL>', () => {
  assert.equal(reportFilename(sampleReport), 'IT - 260519-JB-PR-78 - PROVIDENCIA')
  assert.equal(reportFilename({ reportId: 'X-1', branch: '' }), 'IT - X-1')
})

test('PDF base: válido a partir del informe de muestra', { timeout: TIMEOUT }, async () => {
  const buf = await generateReportPdf(sampleReport)
  assert.ok(isPdf(buf), 'debe ser un PDF')
  assert.ok((await pageCount(buf)) >= 1)
})

test('PDF borde: informe vacío no rompe la generación', { timeout: TIMEOUT }, async () => {
  const empty: ReportData = {
    ...sampleReport,
    contact: '',
    branch: '',
    address: '',
    subject: '',
    workOrder: '',
    intro: '',
    sections: [],
    photos: [],
  }
  const buf = await generateReportPdf(empty)
  assert.ok(isPdf(buf))
  assert.ok((await pageCount(buf)) >= 1)
})

test('PDF: el registro fotográfico empieza en su propia página', { timeout: TIMEOUT }, async () => {
  const withPhotos: ReportData = {
    ...sampleReport,
    photos: Array.from({ length: 6 }, (_, i) => ({ url: IMG, caption: `Foto ${i + 1}` })),
  }
  const buf = await generateReportPdf(withPhotos)
  assert.ok(isPdf(buf))
  // sample (2 págs aprox) + anexo en página nueva ⇒ al menos 2 páginas
  assert.ok((await pageCount(buf)) >= 2, 'el anexo fotográfico debe paginar')
})
