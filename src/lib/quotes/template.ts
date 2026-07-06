import { computeTotals, type QuoteData } from './types'
import { esc, formatDate, formatMoney } from './format'

// Parameterized HTML template — single source of truth shared by the in-app
// QuotePreview (iframe) and the Playwright PDF, so they are identical.
//
// A4 paginated, 3 visual templates (minimal | clasico | imagen-hd).
// Colors come from DESIGN-SYSTEM.MD tokens.

const TOKENS = `
  --color-primary: #f5b100;
  --color-black: #111111;
  --color-bg-section: #1a1a1a;
  --color-text: #333333;
  --color-muted: #666666;
  --color-border: #e5e5e5;
  --color-table-alt: #f9f9f9;
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
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ---- Pagination safety: nothing important splits across pages ---- */
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  p { orphans: 3; widows: 3; }
  .block { margin-bottom: 22px; }
  .avoid, .scope-item, .totals, .signatures, .doc-footer, table.prices tr { break-inside: avoid; }
  /* Keep a section header glued to the content that follows it. */
  .section-header, h2 { break-after: avoid; }
  /* Keep small trailing elements attached to the block above them. */
  .validity, .signatures { break-before: avoid; }
  /* NOTE: the cover is NOT forced onto its own page — content flows right after
     it so short quotes don't leave a near-empty first page. */

  .muted { color: var(--color-muted); }
  .logo { font-weight: 700; color: var(--color-black); letter-spacing: -0.02em; }
  .logo .dot { color: var(--color-primary); }

  /* ---- Cover: shared ---- */
  .cover { position: relative; }
  .cover .tagline { font-weight: 400; color: var(--color-muted); margin-top: 4px; }
  .info-grid { display: flex; flex-wrap: wrap; gap: 10px 28px; margin-top: 22px; }
  .info-grid .field .k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
  .info-grid .field .v { font-weight: 600; color: var(--color-black); font-size: 13px; }
  .stripe { height: 6px; background: var(--color-primary); margin-top: 24px; }

  /* ---- Section header (clasico/hd: black band) ---- */
  .section-header {
    background: var(--color-black);
    color: #ffffff;
    border-left: 4px solid var(--color-primary);
    padding: 9px 14px;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 12px;
  }

  .lead { font-size: 12.5px; }
  .scope-item { padding: 10px 0; border-bottom: 1px solid var(--color-border); }
  .scope-item:last-child { border-bottom: none; }
  .scope-title { font-weight: 600; color: var(--color-black); }
  .scope-detail { margin-top: 2px; }

  /* ---- Price table ---- */
  table.prices { width: 100%; border-collapse: collapse; }
  table.prices thead th {
    background: var(--color-black); color: #ffffff; text-align: left;
    padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em;
  }
  table.prices thead th.num { text-align: right; }
  table.prices tbody td { padding: 8px 10px; font-size: 12px; vertical-align: top; border-bottom: 1px solid var(--color-border); }
  table.prices tbody td.num { text-align: right; white-space: nowrap; }
  table.prices tbody tr:nth-child(even) { background: var(--color-table-alt); }
  table.prices .item-detail { color: var(--color-muted); font-size: 11px; margin-top: 2px; }

  .totals { width: 280px; margin-left: auto; margin-top: 10px; border-collapse: collapse; }
  .totals td { padding: 6px 10px; font-size: 12px; }
  .totals td.num { text-align: right; white-space: nowrap; }
  .totals tr.total td { background: var(--color-black); color: var(--color-primary); font-weight: 700; font-size: 14px; }

  ol.exclusions { padding-left: 20px; }
  ol.exclusions li { padding: 4px 0; }

  ul.conditions { list-style: none; }
  ul.conditions li { padding: 6px 0 6px 16px; position: relative; border-bottom: 1px solid var(--color-border); }
  ul.conditions li:last-child { border-bottom: none; }
  ul.conditions li::before { content: ''; position: absolute; left: 0; top: 12px; width: 6px; height: 6px; background: var(--color-primary); }
  .validity { margin-top: 12px; padding: 10px 12px; background: var(--color-table-alt); border-left: 4px solid var(--color-primary); }

  .signatures { display: flex; gap: 40px; margin-top: 40px; }
  .sign { flex: 1; text-align: center; }
  .sign .line { border-top: 1px solid var(--color-black); margin-bottom: 6px; }
  .sign .who { font-weight: 600; color: var(--color-black); }
  .sign .role { color: var(--color-muted); font-size: 11px; }

  .doc-footer { background: var(--color-black); color: #ffffff; padding: 18px 20px; margin-top: 28px; }
  .doc-footer .logo { color: #ffffff; font-size: 18px; }
  .doc-footer .contact { margin-top: 8px; font-size: 11px; line-height: 1.7; opacity: 0.85; }

  .body-pad { padding-top: 18px; }

  /* ===== Template: Clásico ===== */
  .tpl-clasico .cover { padding: 4px 0 0; }
  .tpl-clasico .cover .logo { font-size: 34px; }

  /* ===== Optional cover banner ===== */
  .cover-banner {
    height: 44mm; margin: 0 0 16px; background-size: cover; background-position: center;
    position: relative; overflow: hidden; border-radius: 3px;
  }
  .cover-banner::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%); }

  /* ===== Registro fotográfico (annex) ===== */
  .photo-grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .photo { width: calc(50% - 6px); break-inside: avoid; }
  .photo img { width: 100%; height: 56mm; object-fit: cover; border: 1px solid var(--color-border); display: block; }
  .photo .caption { font-size: 11px; color: var(--color-muted); margin-top: 4px; }
  `
}

function field(k: string, v: string): string {
  return `<div class="field"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`
}

function renderCover(data: QuoteData): string {
  const info = `<div class="info-grid">
    ${field('Cotización', data.quoteId)}
    ${field('Fecha', formatDate(data.date))}
    ${field('Cliente', data.client.name)}
    ${data.client.rut ? field('RUT', data.client.rut) : ''}
    ${field('Validez', `${data.validityDays} días`)}
  </div>`

  const banner = data.coverImageUrl
    ? `<div class="cover-banner" style="background-image:url('${data.coverImageUrl}')"></div>`
    : ''

  // clásico template (minimal was removed)
  return `<header class="cover">
    ${banner}
    <div class="logo">INGEGAR<span class="dot">.</span></div>
    <div class="tagline">${esc(data.tagline)}</div>
    ${info}
    <div class="stripe"></div>
  </header>`
}

function renderImages(data: QuoteData): string {
  if (!data.images.length) return ''
  const grid = data.images
    .map(
      (img) =>
        `<figure class="photo"><img src="${img.url}" alt="${esc(img.caption || 'Imagen adjunta')}" />${img.caption ? `<figcaption class="caption">${esc(img.caption)}</figcaption>` : ''}</figure>`,
    )
    .join('')
  return `<section class="block">
    ${sectionHeader('Registro fotográfico')}
    <div class="photo-grid">${grid}</div>
  </section>`
}

function renderItemsTable(data: QuoteData): string {
  const cols = data.customColumns
  const head = `<tr>
    <th>Ítem</th>
    ${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}
    <th class="num">Cant.</th>
    <th class="num">Unitario</th>
    <th class="num">Total</th>
  </tr>`

  const rows = data.items
    .map((item) => {
      const lineTotal = item.quantity * item.unitPrice
      const detail = item.detail ? `<div class="item-detail">${esc(item.detail)}</div>` : ''
      const customCells = cols
        .map((c) => `<td>${esc(item.custom?.[c.id] ?? '')}</td>`)
        .join('')
      return `<tr>
        <td>${esc(item.description)}${detail}</td>
        ${customCells}
        <td class="num">${esc(item.quantity)}</td>
        <td class="num">${formatMoney(item.unitPrice, data.currency)}</td>
        <td class="num">${formatMoney(lineTotal, data.currency)}</td>
      </tr>`
    })
    .join('')

  return `<table class="prices"><thead>${head}</thead><tbody>${rows}</tbody></table>`
}

function sectionHeader(title: string): string {
  return `<div class="section-header">${esc(title)}</div>`
}

export function renderQuoteHTML(data: QuoteData): string {
  // Removed templates (e.g. 'minimal') fall back to clasico
  if (data.template !== 'clasico') data = { ...data, template: 'clasico' }

  const totals = computeTotals(data)
  const taxPct = Math.round(data.taxRate * 100)

  const scope = data.scope.length
    ? data.scope
        .map(
          (s) =>
            `<div class="scope-item"><div class="scope-title">${esc(s.title)}</div>${s.detail ? `<div class="scope-detail">${esc(s.detail)}</div>` : ''}</div>`,
        )
        .join('')
    : '<p class="muted">—</p>'

  const exclusions = data.exclusions.length
    ? `<ol class="exclusions">${data.exclusions.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>`
    : '<p class="muted">Sin exclusiones.</p>'

  const conditions = data.commercialConditions.length
    ? `<ul class="conditions">${data.commercialConditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(data.quoteId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet" />
<style>${baseStyles()}</style>
</head>
<body class="tpl-${data.template}">

  ${renderCover(data)}

  <div class="body-pad">
    <section class="block">
      ${sectionHeader('Resumen ejecutivo')}
      <p class="lead">${esc(data.executiveSummary || '—')}</p>
    </section>

    <section class="block">
      ${sectionHeader('Alcance de trabajo')}
      ${scope}
    </section>

    <section class="block">
      ${sectionHeader('Detalle de precios')}
      ${renderItemsTable(data)}
      <table class="totals avoid">
        <tbody>
          ${
            totals.adjustments.length
              ? `<tr><td>Costo base</td><td class="num">${formatMoney(totals.base, data.currency)}</td></tr>` +
                totals.adjustments
                  .map(
                    (a) =>
                      `<tr><td>${esc(a.label)} (${a.percent}%)</td><td class="num">${formatMoney(a.amount, data.currency)}</td></tr>`,
                  )
                  .join('')
              : ''
          }
          <tr><td>Neto</td><td class="num">${formatMoney(totals.net, data.currency)}</td></tr>
          ${taxPct > 0
            ? `<tr><td>IVA (${taxPct}%)</td><td class="num">${formatMoney(totals.tax, data.currency)}</td></tr>`
            : `<tr><td class="muted">Exento de IVA</td><td class="num muted">—</td></tr>`
          }
          <tr class="total"><td>TOTAL</td><td class="num">${formatMoney(totals.total, data.currency)}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="block">
      ${sectionHeader('Exclusiones')}
      ${exclusions}
    </section>

    <section class="block">
      ${sectionHeader('Condiciones comerciales')}
      ${conditions}
      <div class="validity">Validez de esta cotización: <strong>${esc(data.validityDays)} días</strong> a contar del ${esc(formatDate(data.date))}.</div>
    </section>

    ${renderImages(data)}

    <section class="block">
      <div class="signatures">
        <div class="sign"><div class="line"></div><div class="who">${esc(data.contact.company)}</div><div class="role">Oferente</div></div>
        <div class="sign"><div class="line"></div><div class="who">${esc(data.client.name)}</div><div class="role">Aceptación cliente</div></div>
      </div>
    </section>

    <footer class="doc-footer avoid">
      <div class="logo">INGEGAR<span class="dot">.</span></div>
      <div class="contact">
        ${esc(data.contact.company)}<br />
        ${esc(data.contact.email)}${data.contact.phone ? ` · ${esc(data.contact.phone)}` : ''}<br />
        ${esc(data.contact.web)}
      </div>
    </footer>
  </div>

</body>
</html>`
}
