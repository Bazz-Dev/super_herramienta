// Bug real reportado en vivo: nombres de archivo con tildes/ñ (comunes en
// español — "Cerrajería", "Peñaflor") rompían el header Content-Disposition
// con "Cannot convert argument to a ByteString" — los headers HTTP son
// Latin-1/ASCII, nunca UTF-8 directo. RFC 6266: filename= (fallback ASCII)
// + filename*=UTF-8''... (nombre real, lo que usan los navegadores
// modernos). Un solo lugar para las 3 rutas que arman este header
// (api/files, quotes/generate, reports/generate) en vez de repetir el
// encoding en cada una.
export function contentDispositionHeader(disposition: 'inline' | 'attachment', filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
