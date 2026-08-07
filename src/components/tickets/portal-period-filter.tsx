'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const PILLS = [
  { label: 'Este mes', value: 'mes' },
  { label: '3 meses', value: '3m' },
  { label: '6 meses', value: '6m' },
  { label: 'Este año', value: '12m' },
  { label: 'Todo', value: 'total' },
]

// FASE 4 del brief (ajuste de contraste en Reportes): este filtro vive
// SIEMPRE sobre la cabecera roja del portal (ver reportes/page.tsx), nunca
// sobre una tarjeta clara -- usaba var(--p-bd)/var(--p-t2) (pensados para
// fondo claro), así que un filtro no seleccionado quedaba con texto gris
// oscuro y borde gris casi invisibles sobre rojo, y el seleccionado quedaba
// rojo sobre rojo (background: primary, mismo color que la cabecera). Ahora
// hardcoded para el fondo rojo real -- no rediseño, solo contraste.
function Pill({ label, active, primary, onClick }: { label: string; active: boolean; primary: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
        border: active ? 'none' : '1px solid rgba(255,255,255,0.35)',
        background: active ? '#fff' : hover ? 'rgba(255,255,255,0.18)' : 'transparent',
        color: active ? primary : '#fff',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

export function PortalPeriodFilter({ primary, active }: { primary: string; active?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const current = active ?? params.get('periodo') ?? 'total'

  function set(v: string) {
    const p = new URLSearchParams(params.toString())
    if (v === 'total') p.delete('periodo')
    else p.set('periodo', v)
    router.push(`?${p.toString()}`)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {PILLS.map(({ label, value }) => {
        const isActive = current === value || (current === 'total' && value === 'total')
        return <Pill key={value} label={label} active={isActive} primary={primary} onClick={() => set(value)} />
      })}
    </div>
  )
}
