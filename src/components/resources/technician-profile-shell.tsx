'use client'

import { useState } from 'react'

type Tab = 'resumen' | 'datos' | 'vehiculo' | 'documentos' | 'acceso'

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen',    label: 'Resumen'     },
  { id: 'datos',      label: 'Datos'       },
  { id: 'vehiculo',   label: 'Vehículo'    },
  { id: 'documentos', label: 'Documentos'  },
  { id: 'acceso',     label: 'Acceso'      },
]

interface Props {
  header: React.ReactNode
  resumen: React.ReactNode
  datos: React.ReactNode
  vehiculo: React.ReactNode
  documentos: React.ReactNode
  acceso: React.ReactNode
  hasVehicle: boolean
}

export function TechnicianProfileShell({ header, resumen, datos, vehiculo, documentos, acceso, hasVehicle }: Props) {
  const [tab, setTab] = useState<Tab>('resumen')

  return (
    <div className="mx-auto max-w-2xl">
      {header}

      {/* Tab bar */}
      <div className="mb-6 flex border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors -mb-px border-b-2 min-h-11
              ${tab === t.id
                ? 'border-brand text-ink'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            {t.label}
            {t.id === 'vehiculo' && !hasVehicle && (
              <span className="ml-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
            )}
          </button>
        ))}
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
