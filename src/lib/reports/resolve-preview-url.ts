// Fotos y OT del editor de Informe Técnico ahora se guardan como key de R2
// (subida inmediata al elegir el archivo), no como data: URI embebido en el
// JSON del informe — ese embebido es justo lo que hacía que /api/client-documents
// y /api/reports/generate superaran el límite de ~4.5MB por request de Vercel
// con solo 2-3 fotos o una OT escaneada. `data:` sigue soportado para leer
// informes ya guardados antes de este cambio (compatibilidad hacia atrás).
export function isDataUri(value: string): boolean {
  return value.startsWith('data:')
}

// Src utilizable en un <img> del editor (navegador, con cookie de sesión) para
// un valor que puede ser una key de R2 o (legado) un data: URI ya completo.
export function previewSrc(value: string): string {
  if (!value || isDataUri(value)) return value
  return `/api/files?key=${encodeURIComponent(value)}&type=client-editor`
}
