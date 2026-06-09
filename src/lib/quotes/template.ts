import { computeTotals, type QuoteData } from './types'
import { esc, formatDate, formatMoney } from './format'

// Parameterized HTML template — the single source of truth shared by both the
// in-app QuotePreview (iframe) and the Playwright PDF, so they are identical.
//
// Every color/size below comes from DESIGN-SYSTEM.MD tokens. Do NOT introduce
// values that are not in that file.

const TOKENS = `
  --color-primary: #f5b100;
  --color-black: #111111;
  --color-bg-section: #1a1a1a;
  --color-text: #333333;
  --color-muted: #666666;
  --color-border: #e5e5e5;
  --color-table-alt: #f9f9f9;
`

function styles(): string {
  return `
  :root {${TOKENS}}
  @page { size: 390px auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 390px; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--color-text);
    background: #ffffff;
    font-size: 13px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .section { padding: 24px; }
  .muted { color: var(--color-muted); }

  /* ---- Logo ---- */
  .logo { font-weight: 700; color: var(--color-black); letter-spacing: -0.02em; }
  .logo .dot { color: var(--color-primary); }

  /* ---- Portada ---- */
  .cover { padding: 24px; }
  .cover .logo { font-size: 32px; }
  .cover .tagline { font-weight: 400; color: var(--color-muted); margin-top: 4px; font-size: 14px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
  .chip {
    background: var(--color-black);
    color: var(--color-primary);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
  }
  .chip .chip-label { color: #ffffff; font-weight: 400; opacity: 0.7; display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
  .stripe { height: 6px; background: var(--color-primary); margin-top: 20px; }

  /* ---- Section header (banda negra, acento amarillo izquierdo) ---- */
  .section-header {
    background: var(--color-black);
    color: #ffffff;
    border-left: 4px solid var(--color-primary);
    padding: 10px 16px;
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  /* ---- Resumen / texto ---- */
  .lead { font-size: 13px; color: var(--color-text); }

  /* ---- Alcance ---- */
  .scope-item { padding: 12px 0; border-bottom: 1px solid var(--color-border); }
  .scope-item:last-child { border-bottom: none; }
  .scope-title { font-weight: 600; color: var(--color-black); }
  .scope-detail { margin-top: 2px; }

  /* ---- Tabla de precios ---- */
  table.prices { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
  table.prices thead th {
    background: var(--color-black);
    color: #ffffff;
    text-align: left;
    padding: 8px 10px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  table.prices thead th.num { text-align: right; }
  table.prices tbody td { padding: 8px 10px; font-size: 12px; vertical-align: top; }
  table.prices tbody td.num { text-align: right; white-space: nowrap; }
  table.prices tbody tr:nth-child(odd) { background: #ffffff; }
  table.prices tbody tr:nth-child(even) { background: var(--color-table-alt); }
  table.prices .item-detail { color: var(--color-muted); font-size: 11px; margin-top: 2px; }
  .totals { width: 100%; border-collapse: collapse; margin-top: 0; page-break-inside: avoid; }
  .totals td { padding: 6px 10px; font-size: 12px; }
  .totals td.num { text-align: right; white-space: nowrap; }
  .totals tr.total td {
    background: var(--color-black);
    color: var(--color-primary);
    font-weight: 700;
    font-size: 14px;
  }

  /* ---- Exclusiones ---- */
  ol.exclusions { list-style: decimal; padding-left: 20px; }
  ol.exclusions li { padding: 4px 0; }

  /* ---- Condiciones ---- */
  ul.conditions { list-style: none; }
  ul.conditions li { padding: 6px 0; padding-left: 16px; position: relative; border-bottom: 1px solid var(--color-border); }
  ul.conditions li:last-child { border-bottom: none; }
  ul.conditions li::before { content: ''; position: absolute; left: 0; top: 12px; width: 6px; height: 6px; background: var(--color-primary); border-radius: 1px; }
  .validity { margin-top: 12px; padding: 10px 12px; background: var(--color-table-alt); border-left: 4px solid var(--color-primary); font-size: 12px; }

  /* ---- Firma doble ---- */
  .signatures { display: flex; gap: 16px; margin-top: 32px; }
  .sign { flex: 1; text-align: center; }
  .sign .line { border-top: 1px solid var(--color-black); margin-bottom: 6px; }
  .sign .who { font-weight: 600; color: var(--color-black); font-size: 12px; }
  .sign .role { color: var(--color-muted); font-size: 11px; }

  /* ---- Footer ---- */
  .footer { background: var(--color-black); color: #ffffff; padding: 24px; page-break-inside: avoid; }
  .footer .logo { color: #ffffff; font-size: 20px; }
  .footer .contact { margin-top: 10px; font-size: 11px; line-height: 1.7; opacity: 0.85; }
  `
}

function renderChips(data: QuoteData): string {
  const chips =
    data.chips.length > 0
      ? data.chips
      : [
          { label: 'Cotización', value: data.quoteId },
          { label: 'Fecha', value: formatDate(data.date) },
          { label: 'Cliente', value: data.client.name },
          { label: 'Validez', value: `${data.validityDays} días` },
        ]
  return chips
    .slice(0, 4)
    .map(
      (c) =>
        `<div class="chip"><span class="chip-label">${esc(c.label)}</span>${esc(c.value)}</div>`,
    )
    .join('')
}

function renderItemsRows(data: QuoteData): string {
  return data.items
    .map((item) => {
      const lineTotal = item.quantity * item.unitPrice
      const detail = item.detail
        ? `<div class="item-detail">${esc(item.detail)}</div>`
        : ''
      return `<tr>
        <td>${esc(item.description)}${detail}</td>
        <td class="num">${esc(item.quantity)}</td>
        <td class="num">${formatMoney(item.unitPrice, data.currency)}</td>
        <td class="num">${formatMoney(lineTotal, data.currency)}</td>
      </tr>`
    })
    .join('')
}

export function renderQuoteHTML(data: QuoteData): string {
  const totals = computeTotals(data)
  const taxPct = Math.round(data.taxRate * 100)

  const scope = data.scope
    .map(
      (s) =>
        `<div class="scope-item"><div class="scope-title">${esc(s.title)}</div><div class="scope-detail">${esc(s.detail)}</div></div>`,
    )
    .join('')

  const exclusions =
    data.exclusions.length > 0
      ? `<ol class="exclusions">${data.exclusions.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>`
      : '<p class="muted">Sin exclusiones.</p>'

  const conditions =
    data.commercialConditions.length > 0
      ? `<ul class="conditions">${data.commercialConditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
      : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=390" />
<title>${esc(data.quoteId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
<style>${styles()}</style>
</head>
<body>

  <!-- 1. Portada -->
  <header class="cover">
    <div class="logo">INGEGAR<span class="dot">.</span></div>
    <div class="tagline">${esc(data.tagline)}</div>
    <div class="chips">${renderChips(data)}</div>
    <div class="stripe"></div>
  </header>

  <!-- 2. Resumen ejecutivo -->
  <div class="section-header">Resumen ejecutivo</div>
  <section class="section"><p class="lead">${esc(data.executiveSummary)}</p></section>

  <!-- 3. Alcance de trabajo -->
  <div class="section-header">Alcance de trabajo</div>
  <section class="section">${scope}</section>

  <!-- 4. Tabla de precios -->
  <div class="section-header">Detalle de precios</div>
  <section class="section">
    <table class="prices">
      <thead>
        <tr>
          <th>Ítem</th>
          <th class="num">Cant.</th>
          <th class="num">Unitario</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${renderItemsRows(data)}</tbody>
    </table>
    <table class="totals">
      <tbody>
        <tr><td>Neto</td><td class="num">${formatMoney(totals.net, data.currency)}</td></tr>
        <tr><td>IVA (${taxPct}%)</td><td class="num">${formatMoney(totals.tax, data.currency)}</td></tr>
        <tr class="total"><td>TOTAL</td><td class="num">${formatMoney(totals.total, data.currency)}</td></tr>
      </tbody>
    </table>
  </section>

  <!-- 5. Exclusiones -->
  <div class="section-header">Exclusiones</div>
  <section class="section">${exclusions}</section>

  <!-- 6. Condiciones comerciales -->
  <div class="section-header">Condiciones comerciales</div>
  <section class="section">
    ${conditions}
    <div class="validity">Validez de esta cotización: <strong>${esc(data.validityDays)} días</strong> a contar del ${esc(formatDate(data.date))}.</div>
  </section>

  <!-- 7. Firma doble -->
  <section class="section">
    <div class="signatures">
      <div class="sign">
        <div class="line"></div>
        <div class="who">${esc(data.contact.company)}</div>
        <div class="role">Oferente</div>
      </div>
      <div class="sign">
        <div class="line"></div>
        <div class="who">${esc(data.client.name)}</div>
        <div class="role">Aceptación cliente</div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <div class="logo">INGEGAR<span class="dot">.</span></div>
    <div class="contact">
      ${esc(data.contact.company)}<br />
      ${esc(data.contact.email)}${data.contact.phone ? ` · ${esc(data.contact.phone)}` : ''}<br />
      ${esc(data.contact.web)}
    </div>
  </footer>

</body>
</html>`
}
