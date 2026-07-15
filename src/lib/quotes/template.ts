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

  .body-pad { padding-top: 6px; }

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

function proStyles(): string {
  return `
  /* ===== Template: Pro ===== */
  .tpl-pro .pro-header { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .tpl-pro .pro-logo { font-size: 32px; font-weight: 900; color: var(--color-black); letter-spacing: -0.02em; }
  .tpl-pro .pro-logo .dot { color: var(--color-primary); }
  .tpl-pro .pro-tagline { font-size: 9px; color: var(--color-muted); margin-top: 4px; }
  .tpl-pro .pro-proposal { text-align: right; }
  .tpl-pro .pro-proposal strong { display: block; font-size: 11px; font-weight: 700; color: var(--color-black); }
  .tpl-pro .pro-proposal span { display: block; font-size: 9px; color: var(--color-muted); margin-top: 2px; }
  .tpl-pro .pro-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 14px; margin-top: 14px; }
  .tpl-pro .pro-meta small { display: block; color: #777; text-transform: uppercase; font-size: 7.5px; letter-spacing: 0.05em; }
  .tpl-pro .pro-meta b { display: block; margin-top: 2px; font-size: 10px; font-weight: 600; color: var(--color-black); }
  .tpl-pro .pro-rule { height: 4px; background: var(--color-primary); margin: 14px 0 8px; }
  .tpl-pro .pro-hero { background: var(--color-black); color: #fff; border-left: 5px solid var(--color-primary); padding: 12px 14px; break-inside: avoid; margin-bottom: 18px; }
  .tpl-pro .pro-hero .eyebrow { color: var(--color-primary); font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .tpl-pro .pro-hero h1 { margin: 0 0 6px; font-size: 18px; line-height: 1.1; color: #fff; }
  .tpl-pro .pro-hero p { margin: 0; color: #d8d8d8; font-size: 10px; line-height: 1.55; }
  .tpl-pro .pro-scope { border: 1px solid var(--color-border); }
  .tpl-pro .pro-scope-item { padding: 9px 11px; border-bottom: 1px solid var(--color-border); font-size: 10px; }
  .tpl-pro .pro-scope-item:last-child { border-bottom: none; }
  .tpl-pro .pro-scope-item:nth-child(even) { background: var(--color-table-alt); }
  .tpl-pro .pro-scope-item .st { display: block; font-weight: 600; color: var(--color-black); margin-bottom: 2px; font-size: 10.5px; }
  .tpl-pro .pro-summary { width: 67%; margin: 12px 0 0 auto; }
  .tpl-pro .pro-sumrow { display: grid; grid-template-columns: 1fr auto; padding: 7px 10px; border: 1px solid var(--color-border); border-top: none; font-size: 11px; align-items: center; gap: 12px; }
  .tpl-pro .pro-sumrow:first-child { border-top: 1px solid var(--color-border); }
  .tpl-pro .pro-sumrow b { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .tpl-pro .pro-sumrow.iva { background: #fff8d5; }
  .tpl-pro .pro-sumrow.final { background: var(--color-black); color: #fff; font-weight: 700; font-size: 13px; }
  .tpl-pro .pro-sumrow.final b { color: var(--color-primary); }
  .tpl-pro .pro-conditions { width: 100%; border-collapse: collapse; }
  .tpl-pro .pro-conditions td { border: 1px solid var(--color-border); padding: 7px 10px; font-size: 10.5px; vertical-align: top; }
  .tpl-pro .pro-conditions .cond-label { width: 26%; background: #f5f5f5; font-weight: 600; color: var(--color-black); }
  `
}

function renderProTemplate(data: QuoteData): string {
  const totals = computeTotals(data)
  const taxPct = Math.round(data.taxRate * 100)

  // Hero title: first scope title, or the quoteId as fallback
  const heroTitle = data.scope.length > 0 ? data.scope[0].title : data.quoteId
  // Hero eyebrow: short factual summary of the proposal scope
  const heroEyebrow = [
    data.scope.length > 1 ? `${data.scope.length} actividades en alcance` : '',
    data.items.length > 0 ? `${data.items.length} ítem${data.items.length > 1 ? 's' : ''} cotizado${data.items.length > 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' · ')

  const scopeItems = data.scope.length
    ? data.scope.map((s) => `<div class="pro-scope-item">
        <span class="st">${esc(s.title)}</span>
        ${s.detail ? `<span>${esc(s.detail)}</span>` : ''}
      </div>`).join('')
    : '<div class="pro-scope-item"><span class="muted">Sin alcance definido.</span></div>'

  // Conditions: detect "Label: value" format for table layout
  const conditionRows = data.commercialConditions.length
    ? data.commercialConditions.map((c) => {
        const colonIdx = c.indexOf(': ')
        if (colonIdx > 0 && colonIdx < 45) {
          return `<tr><td class="cond-label">${esc(c.slice(0, colonIdx))}</td><td>${esc(c.slice(colonIdx + 2))}</td></tr>`
        }
        return `<tr><td class="cond-label">—</td><td>${esc(c)}</td></tr>`
      }).join('')
    : `<tr><td colspan="2" style="color:#888;font-size:10px">Sin condiciones especificadas.</td></tr>`

  const exclusions = data.exclusions.length
    ? `<ol class="exclusions">${data.exclusions.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>`
    : '<p class="muted">Sin exclusiones.</p>'

  const adjustmentRows = totals.adjustments.length
    ? `<div class="pro-sumrow"><span>Costo base</span><b>${formatMoney(totals.base, data.currency)}</b></div>` +
      totals.adjustments.map((a) =>
        `<div class="pro-sumrow"><span>${esc(a.label)} (${a.percent}%)</span><b>${formatMoney(a.amount, data.currency)}</b></div>`,
      ).join('')
    : ''

  const economicSummary = `<div class="pro-summary avoid">
    ${adjustmentRows}
    <div class="pro-sumrow"><span>Neto</span><b>${formatMoney(totals.net, data.currency)}</b></div>
    ${taxPct > 0
      ? `<div class="pro-sumrow iva"><span>IVA (${taxPct}%)</span><b>${formatMoney(totals.tax, data.currency)}</b></div>`
      : `<div class="pro-sumrow"><span style="color:#888">Exento de IVA</span><b style="color:#888">—</b></div>`
    }
    <div class="pro-sumrow final"><span>TOTAL</span><b>${formatMoney(totals.total, data.currency)}</b></div>
  </div>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(data.quoteId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap" rel="stylesheet" />
<style>${baseStyles()}${proStyles()}</style>
</head>
<body class="tpl-pro">

  <div class="pro-header">
    <div>
      <div class="pro-logo">INGEGAR<span class="dot">.</span></div>
      <div class="pro-tagline">${esc(data.tagline)}</div>
    </div>
    <div class="pro-proposal">
      <strong>PROPUESTA DE SERVICIO</strong>
      <span>${esc(data.scope.length > 0 ? data.scope[0].title : 'Propuesta de servicio técnico')}</span>
      <span>${esc(data.contact.company)}</span>
    </div>
  </div>

  <div class="pro-meta">
    <div><small>Cotización</small><b>${esc(data.quoteId)}</b></div>
    <div><small>Fecha</small><b>${esc(formatDate(data.date))}</b></div>
    <div><small>Cliente</small><b>${esc(data.client.name)}</b></div>
    <div><small>Contacto</small><b>${esc(data.client.contact ?? '—')}</b></div>
    <div><small>RUT / cobertura</small><b>${esc(data.client.rut ?? '—')}</b></div>
    <div><small>Validez</small><b>${esc(data.validityDays)} días corridos</b></div>
  </div>

  <div class="pro-rule"></div>

  <div class="pro-hero">
    ${heroEyebrow ? `<div class="eyebrow">${esc(heroEyebrow)}</div>` : ''}
    <h1>${esc(heroTitle)}</h1>
    ${data.executiveSummary ? `<p>${esc(data.executiveSummary)}</p>` : ''}
  </div>

  <div class="body-pad">
    <section class="block">
      ${sectionHeader('Alcance del servicio')}
      <div class="pro-scope">${scopeItems}</div>
    </section>

    <section class="block">
      ${sectionHeader('Detalle de precios')}
      ${renderItemsTable(data)}
      ${economicSummary}
    </section>

    <section class="block">
      ${sectionHeader('Exclusiones')}
      ${exclusions}
    </section>

    <section class="block">
      ${sectionHeader('Condiciones comerciales')}
      <table class="pro-conditions">
        <tbody>${conditionRows}</tbody>
      </table>
      <div class="validity" style="margin-top:12px">Validez: <strong>${esc(data.validityDays)} días corridos</strong> desde ${esc(formatDate(data.date))}.</div>
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

export function renderQuoteHTML(data: QuoteData): string {
  if (data.template === 'pro') return renderProTemplate(data)

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
