'use client'

import { useState, type ReactNode } from 'react'

// Sección plegable genérica — usada por fichas largas (ver /flujo/trabajos/[id])
// para agrupar campos relacionados sin perder ninguno, mostrando un resumen
// de datos reales cuando está cerrada. defaultOpen decide el estado inicial;
// forceOpen (deep-link, ej. ?section=documentos) lo abre sin importar
// defaultOpen.
export function CollapsibleSection({
  title, summary, defaultOpen = false, forceOpen = false, children,
}: {
  title: string
  summary?: ReactNode
  defaultOpen?: boolean
  forceOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen || forceOpen)

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/60"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-ink">{title}</span>
        <div className="flex min-w-0 items-center gap-3">
          {!open && summary && <span className="truncate text-xs text-gray-400">{summary}</span>}
          <svg
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
          >
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      {open && <div className="border-t border-gray-100 px-4 py-4">{children}</div>}
    </section>
  )
}
