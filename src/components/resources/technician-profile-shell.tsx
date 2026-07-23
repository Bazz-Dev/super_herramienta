'use client'

import { useState, type ReactNode, type SVGProps } from 'react'

type Tab = 'resumen' | 'datos' | 'vehiculo' | 'documentos' | 'acceso'

const TABS: { id: Tab; label: string; icon: (p: SVGProps<SVGSVGElement>) => ReactNode }[] = [
  { id: 'resumen',    label: 'Resumen',    icon: ResumenIcon },
  { id: 'datos',      label: 'Datos',      icon: DatosIcon },
  { id: 'vehiculo',   label: 'Vehículo',   icon: VehiculoIcon },
  { id: 'documentos', label: 'Documentos', icon: DocumentosIcon },
  { id: 'acceso',     label: 'Acceso',     icon: AccesoIcon },
]

interface Props {
  header: ReactNode
  resumen: ReactNode
  datos: ReactNode
  vehiculo: ReactNode
  documentos: ReactNode
  acceso: ReactNode
  hasVehicle: boolean
}

export function TechnicianProfileShell({ header, resumen, datos, vehiculo, documentos, acceso, hasVehicle }: Props) {
  const [tab, setTab] = useState<Tab>('resumen')

  return (
    <div className="mx-auto max-w-4xl">
      {header}

      {/* Tab bar — segmented pill control, icons for scannability */}
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl border border-gray-200 bg-gray-50 p-1.5">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`interactive relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors
                ${tab === t.id
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{t.label}</span>
              {t.id === 'vehiculo' && !hasVehicle && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* Panels — all mounted, toggled by CSS to preserve form state */}
      <div className={tab === 'resumen'    ? 'block' : 'hidden'}>{resumen}</div>
      <div className={tab === 'datos'      ? 'block' : 'hidden'}>{datos}</div>
      <div className={tab === 'vehiculo'   ? 'block' : 'hidden'}>{vehiculo}</div>
      <div className={tab === 'documentos' ? 'block' : 'hidden'}>{documentos}</div>
      <div className={tab === 'acceso'     ? 'block' : 'hidden'}>{acceso}</div>
    </div>
  )
}

function ResumenIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}
function DatosIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0116 0v1" />
    </svg>
  )
}
function VehiculoIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13" />
      <path d="M3 13h18v4a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
      <circle cx="7.5" cy="17" r="1.5" /><circle cx="16.5" cy="17" r="1.5" />
    </svg>
  )
}
function DocumentosIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}
function AccesoIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}
