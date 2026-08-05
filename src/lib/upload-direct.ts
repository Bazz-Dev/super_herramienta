// Subida en 2 pasos, directo del navegador a R2 — evita el límite de payload
// de la función serverless (~4.5MB, confirmado en vivo el 2026-07-30 con
// fotos de celular normales sobre /api/tickets/[id]/documents). 1) pide una
// URL prefirmada al endpoint del recurso (auth/validación ahí, igual que
// antes); 2) PUT directo del archivo a esa URL (mismo origen R2, requiere
// CORS del bucket — ver docs/architecture/GAP_REGISTER.md); 3) el caller
// registra la key resultante en su propio endpoint "finalize".
export async function uploadDirect(
  urlEndpoint: string,
  file: File,
  extra?: Record<string, unknown>,
): Promise<{ key: string; contentType: string }> {
  const res = await fetch(urlEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, ...extra }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error ${res.status} al preparar la subida`)
  }
  const { uploadUrl, key, contentType } = await res.json() as { uploadUrl: string; key: string; contentType: string }

  const putRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } })
  if (!putRes.ok) throw new Error(`Error ${putRes.status} al subir el archivo a almacenamiento`)

  return { key, contentType }
}
