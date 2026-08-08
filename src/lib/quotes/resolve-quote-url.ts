// Equivalente exacto de resolve-informe-url.ts pero para propuestas — mismos
// dos casos (archivo real subido vs. generado on-demand), mismo criterio de
// prioridad (viewUrl gana siempre que exista) y mismo motivo (GAP_REGISTER
// G63: el CORS del bucket R2 solo permite PUT, así que un fetch/descarga
// directa contra la URL presignada cruda falla en silencio; /api/files es
// same-origin). Antes solo existía para informes -- las propuestas del
// portal (portal-propuesta-list.tsx) no tenían "Ver", solo "Descargar".
export async function resolveQuoteUrl(docId: string, opts?: { download?: boolean; filename?: string }): Promise<string> {
  const metaRes = await fetch(`/api/portal/propuestas?id=${docId}`)
  if (!metaRes.ok) throw new Error('No se pudo cargar la propuesta')
  const { dataJson, viewUrl } = await metaRes.json()

  if (viewUrl) {
    if (opts?.download && typeof viewUrl === 'string' && viewUrl.startsWith('/api/files')) {
      return `${viewUrl}&download=1&filename=${encodeURIComponent(opts.filename ?? 'propuesta.pdf')}`
    }
    return viewUrl
  }
  if (!dataJson) throw new Error('Propuesta sin contenido')

  const pdfRes = await fetch('/api/quotes/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: docId }),
  })
  if (!pdfRes.ok) throw new Error('Error generando PDF')
  const blob = await pdfRes.blob()
  return URL.createObjectURL(blob)
}
