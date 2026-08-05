'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { FilePreviewButton } from '@/components/ui/file-preview-modal'

// Ícono compacto de "¿existe este documento en el ticket?" para la fila de
// Conciliación (pedido explícito del dueño) — gris + clic a agregar si
// falta, de color + preview in-place (reusa FilePreviewButton, el único
// patrón de preview de la app, ver frontend.md) si existe. Nunca navega
// fuera de la página para previsualizar; para AGREGAR sí navega al ticket,
// que es donde ya vive el mecanismo real de subida (nunca un segundo
// uploader acá).
export function DocStatusIcon({
  ticketId, label, icon, files, directLink = false,
}: {
  ticketId: string
  label: string
  icon: ReactNode
  files: { fileUrl: string; name: string }[]
  // Boletas/comprobantes (Expense.receiptUrl) pueden ser data: URI o key de
  // R2 legado — FilePreviewButton asume que todo lo que no es 'inline'/ruta/
  // http es una key de R2 y lo manda por /api/files, lo que rompe un data:
  // URI. Mismo bug ya evitado en ticket-documents-panel.tsx ("Boletas y
  // compras" usa <a href> directo) — acá se replica el mismo criterio en vez
  // de reintroducirlo.
  directLink?: boolean
}) {
  const base = 'interactive inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors'

  if (files.length === 0) {
    return (
      <Link
        href={`/tickets/${ticketId}`}
        title={`${label}: falta — clic para agregar`}
        className={`${base} border-gray-200 bg-gray-50 text-gray-300 hover:border-gray-300 hover:text-gray-400`}
        onClick={(e) => {
          if (!confirm(`Este ticket todavía no tiene ${label.toLowerCase()}. ¿Ir al ticket para agregarlo?`)) e.preventDefault()
        }}
      >
        {icon}
      </Link>
    )
  }

  const latest = files[0]
  const activeClass = `${base} border-brand/30 bg-brand/10 text-brand-600 hover:bg-brand/20`
  return (
    <span className="relative inline-flex">
      {directLink ? (
        <a href={latest.fileUrl} target="_blank" rel="noopener noreferrer" title={latest.name} className={activeClass}>
          {icon}
        </a>
      ) : (
        <FilePreviewButton fileUrl={latest.fileUrl} type="ticket" name={latest.name} label={icon} className={activeClass} />
      )}
      {files.length > 1 && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-ink px-0.5 text-[9px] font-bold text-white">
          {files.length}
        </span>
      )}
    </span>
  )
}

export function DocIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
      <path d="M9 2v3h3"/>
    </svg>
  )
}

export function PhotoIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5"/>
      <circle cx="5.5" cy="6.5" r="1.3"/>
      <path d="M14.5 10.5l-3.5-3-4 4-1.5-1.5-4 3.5"/>
    </svg>
  )
}

export function OtIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="2" width="10" height="12" rx="1.2"/>
      <path d="M6 1.5h4v1.5H6z"/>
      <path d="M5.5 7l1.5 1.5L10.5 5"/>
    </svg>
  )
}

export function ReceiptIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 1.5h9v13l-1.8-1.2-1.7 1.2-1.7-1.2-1.7 1.2-1.7-1.2-1.8 1.2v-13z"/>
      <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3"/>
    </svg>
  )
}
