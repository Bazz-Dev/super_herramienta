// Resuelve un informe técnico del portal a una URL usable (network o blob:) --
// caso (a) archivo real subido (viewUrl directo, sin dataJson) o (b)
// generado on-demand vía /api/reports/generate (se manda solo el id, el
// servidor re-deriva y re-verifica el contenido, ver P0). Compartido entre
// portal-informe-btn.tsx (ticket detail) y portal-informe-list.tsx
// (biblioteca /informes) para no duplicar esta lógica en dos lugares.
//
// opts.download: para el caso (a), viewUrl es una ruta propia
// (/api/files?...&type=client-document, mismo origen -- ver
// /api/portal/informes) que por defecto REDIRIGE a R2 (para que <iframe>/
// <img> la puedan cargar directo). Un <a download> sobre esa redirección
// sigue terminando cruzada de origen y el navegador la ignora iguel que con
// la URL cruda de antes -- agregar &download=1&filename=... hace que la
// misma ruta devuelva los bytes directo, mismo origen de punta a punta, así
// que <a href=... download> sí funciona.
export async function resolveInformeUrl(docId: string, opts?: { download?: boolean; filename?: string }): Promise<string> {
  const metaRes = await fetch(`/api/portal/informes?id=${docId}`)
  if (!metaRes.ok) throw new Error('No se pudo cargar el informe')
  const { dataJson, viewUrl } = await metaRes.json()

  // viewUrl gana siempre que exista: un archivo real ya subido a R2 es la
  // fuente de verdad. Antes se decidía por `!dataJson`, pero un informe con
  // archivo real puede TAMBIÉN traer un dataJson no vacío (ej. un stub
  // `{"workOrder":"..."}` escrito por otro flujo, sin relación con el
  // ReportData completo) -- bug real reportado en vivo: "Ver"/"Descargar"
  // no funcionaban para ese informe porque esta función intentaba generar
  // un PDF desde ese stub incompleto en vez de usar el archivo real que sí
  // existía, y /api/reports/generate rechazaba el stub con 422.
  if (viewUrl) {
    if (opts?.download && typeof viewUrl === 'string' && viewUrl.startsWith('/api/files')) {
      return `${viewUrl}&download=1&filename=${encodeURIComponent(opts.filename ?? 'informe.pdf')}`
    }
    return viewUrl
  }
  if (!dataJson) throw new Error('Informe sin contenido')

  const pdfRes = await fetch('/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: docId }),
  })
  if (!pdfRes.ok) throw new Error('Error generando PDF')
  const blob = await pdfRes.blob()
  return URL.createObjectURL(blob)
}
