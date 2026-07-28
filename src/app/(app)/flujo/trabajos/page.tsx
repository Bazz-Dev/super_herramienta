import { redirect } from 'next/navigation'

// La lista plana de /flujo/trabajos quedó estrictamente por debajo de las
// otras dos vistas reales (el acordeón de /flujo, que ya agrupa/busca/edita
// inline, y /flujo/reportes, que tiene la misma tabla con más columnas +
// filtros + export) — dos vistas mediocres duplicando una buena. Redirect
// para bookmarks/links viejos, mismo patrón que /recursos -> /recursos/activos.
export default async function TrabajosRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1])).toString()
  redirect(`/flujo/reportes${qs ? `?${qs}` : ''}`)
}
