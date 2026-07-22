import type { ReportData } from './types'
import { esc } from '@/lib/quotes/format'

// Parameterized HTML for the technical report — single source of truth shared by
// the in-app ReportPreview (iframe) and the Playwright PDF, so they're identical.
// A4 paginated, with pagination-safety rules so sections and photos never split.

const TOKENS = `
  --color-primary: #f5b100;
  --color-black: #111111;
  --color-text: #333333;
  --color-muted: #666666;
  --color-border: #e5e5e5;
  --color-band: #f7f7f7;
`

function baseStyles(): string {
  return `
  :root {${TOKENS}}
  @page { size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--color-text);
    background: #ffffff;
    font-size: 12px;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ---- Pagination safety ---- */
  p { orphans: 3; widows: 3; }
  .block { margin-bottom: 22px; }
  .section, .photo, .id-card { break-inside: avoid; }
  .section-header, .annex-header, h2 { break-after: avoid; }

  .muted { color: var(--color-muted); }
  .logo { font-weight: 700; color: var(--color-black); letter-spacing: -0.02em; font-size: 30px; }
  .logo .dot { color: var(--color-primary); }

  /* ---- Masthead (branded header band) ---- */
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 16px; border-bottom: 3px solid var(--color-primary); }
  .masthead .tagline { color: var(--color-muted); margin-top: 3px; font-size: 12px; letter-spacing: 0.01em; }
  .masthead .web { color: var(--color-muted); font-size: 10px; margin-top: 8px; }
  .masthead .right { text-align: right; }
  .masthead .doc-type { font-size: 18px; font-weight: 700; color: var(--color-black); letter-spacing: 0.06em; }
  .masthead .dept { font-size: 10.5px; color: var(--color-muted); margin-top: 4px; line-height: 1.6; }
  .masthead .version { display: inline-block; margin-top: 8px; padding: 3px 9px; background: var(--color-black); color: #fff; font-size: 9px; letter-spacing: 0.06em; border-radius: 3px; }

  /* ---- Identification card ---- */
  .id-card { margin-top: 20px; border: 1px solid var(--color-border); border-radius: 6px; overflow: hidden; box-shadow: 0 1px 2px rgba(17,17,17,0.04); }
  .id-row { display: flex; border-bottom: 1px solid var(--color-border); }
  .id-row:last-child { border-bottom: none; }
  .id-cell { flex: 1; display: flex; min-width: 0; }
  .id-cell + .id-cell { border-left: 1px solid var(--color-border); }
  .id-k { width: 104px; flex-shrink: 0; padding: 9px 12px; background: var(--color-band); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); display: flex; align-items: center; }
  .id-v { padding: 9px 12px; font-size: 12px; color: var(--color-black); font-weight: 600; word-break: break-word; }

  .intro-line { margin-top: 22px; font-size: 13px; font-weight: 600; color: var(--color-black); }

  /* ---- Numbered section header (black band, brand accent) ---- */
  .section { margin-top: 22px; }
  .section-header {
    background: var(--color-black); color: #ffffff; border-left: 4px solid var(--color-primary);
    padding: 10px 16px; font-weight: 600; font-size: 12.5px; letter-spacing: 0.03em; margin-bottom: 12px;
  }
  .section-header .n { color: var(--color-primary); margin-right: 7px; }
  .section-body { font-size: 12px; }
  .section-body p { margin-bottom: 10px; }
  ul.bullets { list-style: none; margin-top: 4px; }
  ul.bullets li { position: relative; padding: 5px 0 5px 17px; }
  ul.bullets li::before { content: ''; position: absolute; left: 0; top: 11px; width: 6px; height: 6px; background: var(--color-primary); border-radius: 1px; }

  /* ---- Annex header (registro fotográfico / OT) — distinto de las secciones
     numeradas: son material de respaldo, no parte del cuerpo del informe. ---- */
  .annex { break-before: page; }
  .annex-header {
    display: flex; align-items: baseline; gap: 8px; padding-bottom: 8px; margin-bottom: 14px;
    border-bottom: 2px solid var(--color-primary);
  }
  .annex-header .eyebrow { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-primary); }
  .annex-header .title { font-size: 13px; font-weight: 700; color: var(--color-black); }

  .photo-grid { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px; }
  .photo { width: calc(50% - 7px); break-inside: avoid; }
  .photo img { width: 100%; height: 62mm; object-fit: cover; border: 1px solid var(--color-border); display: block; border-radius: 4px; box-shadow: 0 1px 3px rgba(17,17,17,0.06); }
  .photo .caption { font-size: 11px; color: var(--color-muted); margin-top: 5px; }

  /* ---- OT annex (última página) ---- */
  .ot-photo { width: 100%; }
  .ot-photo img { width: 100%; height: 235mm; object-fit: contain; background: var(--color-band); border: 1px solid var(--color-border); display: block; border-radius: 4px; }

  /* ---- Footer block ---- */
  .doc-footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid var(--color-border); font-size: 10.5px; color: var(--color-muted); line-height: 1.7; }
  .doc-footer strong { color: var(--color-black); }
  `
}

function idCell(k: string, v: string): string {
  return `<div class="id-cell"><div class="id-k">${esc(k)}</div><div class="id-v">${esc(v || '—')}</div></div>`
}

function renderMasthead(data: ReportData): string {
  return `<header class="masthead">
    <div class="left">
      <div class="logo">INGEGAR<span class="dot">.</span></div>
      <div class="tagline">Expertos a tu servicio</div>
      <div class="web">${esc(data.web)}</div>
    </div>
    <div class="right">
      <div class="doc-type">INFORME TÉCNICO</div>
      <div class="dept">Departamento de mantención<br />Servicios de ingeniería y construcción<br />${esc(data.company)} · Rut: ${esc(data.rut)}</div>
      <div class="version">VERSIÓN ${esc(data.version)}</div>
    </div>
  </header>`
}

function renderIdCard(data: ReportData): string {
  return `<div class="id-card">
    <div class="id-row">
      ${idCell('Contacto', data.contact)}
    </div>
    <div class="id-row">
      ${idCell('Cliente', data.client)}
      ${idCell('Sucursal', data.branch)}
    </div>
    <div class="id-row">
      ${idCell('Dirección', data.address)}
    </div>
    <div class="id-row">
      ${idCell('Observación', data.subject)}
    </div>
    ${
      data.workOrder
        ? `<div class="id-row">${idCell('N° OT', data.workOrder)}${idCell('Código', data.reportId)}</div>`
        : `<div class="id-row">${idCell('Código', data.reportId)}</div>`
    }
  </div>`
}

function renderSections(data: ReportData): string {
  return data.sections
    .map((s, i) => {
      const body = s.body ? `<p>${esc(s.body).replace(/\n/g, '<br />')}</p>` : ''
      const bullets = s.bullets.length
        ? `<ul class="bullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
        : ''
      return `<section class="section">
        <div class="section-header"><span class="n">${i + 1}.</span>${esc(s.title)}</div>
        <div class="section-body">${body}${bullets}</div>
      </section>`
    })
    .join('')
}

function renderPhotos(data: ReportData): string {
  if (!data.photos.length) return ''
  const grid = data.photos
    .map(
      (p) =>
        `<figure class="photo"><img src="${p.url}" alt="${esc(p.caption || 'Registro fotográfico')}" />${p.caption ? `<figcaption class="caption">${esc(p.caption)}</figcaption>` : ''}</figure>`,
    )
    .join('')
  return `<section class="annex">
    <div class="annex-header"><span class="eyebrow">Anexo</span><span class="title">Registro fotográfico</span></div>
    <div class="photo-grid">${grid}</div>
  </section>`
}

function renderOTAnnex(data: ReportData): string {
  if (!data.otImageUrl) return ''
  const title = data.workOrder ? `Orden de trabajo · N° ${esc(data.workOrder)}` : 'Orden de trabajo'
  return `<section class="annex">
    <div class="annex-header"><span class="eyebrow">Anexo</span><span class="title">${title}</span></div>
    <div class="photo-grid"><figure class="photo ot-photo"><img src="${data.otImageUrl}" alt="Orden de trabajo" /></figure></div>
  </section>`
}

export function renderReportHTML(data: ReportData): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(data.reportId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet" />
<style>${baseStyles()}</style>
</head>
<body>
  ${renderMasthead(data)}
  ${renderIdCard(data)}
  ${data.intro ? `<p class="intro-line">${esc(data.intro)}</p>` : ''}
  ${renderSections(data)}
  ${renderPhotos(data)}
  ${renderOTAnnex(data)}
  <footer class="doc-footer">
    <strong>${esc(data.company)}</strong> · Rut: ${esc(data.rut)}<br />
    ${esc(data.email)}${data.phone ? ` · ${esc(data.phone)}` : ''} · ${esc(data.web)}
  </footer>
</body>
</html>`
}
