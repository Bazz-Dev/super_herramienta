'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/resources/modal'
import { buttonClass } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getQuoteSequenceConfig, updateQuoteSequenceConfig } from '@/app/(app)/cotizador/actions'

export function QuoteSequenceConfigButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<{ nextNumber: number; updatedAt: Date; updatedByName: string | null } | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function openModal() {
    setOpen(true)
    setSaved(false)
    setError('')
    setLoading(true)
    try {
      const c = await getQuoteSequenceConfig()
      setConfig(c)
      setValue(c ? String(c.nextNumber) : '')
    } finally {
      setLoading(false)
    }
  }

  function submit() {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1) { setError('Ingresa un número entero positivo.'); return }
    setError('')
    if (!confirm(`El próximo número de presupuesto será ${n.toLocaleString('es-CL')}. Una vez guardado, no podrás volver a un número anterior. ¿Deseas continuar?`)) return
    startTransition(async () => {
      const res = await updateQuoteSequenceConfig(n)
      if (!res.success) { setError(res.error); return }
      setSaved(true)
      // Refresca "último usado" / "próximo configurado" con el valor real
      // guardado — no basta con marcar saved=true, los números mostrados
      // vienen de `config` y quedarían stale si no se vuelven a pedir.
      const c = await getQuoteSequenceConfig()
      setConfig(c)
    })
  }

  return (
    <>
      <button type="button" onClick={openModal} className={buttonClass('secondary', 'sm')}>
        🔑 Configuración de presupuestos
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Configuración de presupuestos">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size={24} /></div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Último presupuesto utilizado</p>
                <p className="mt-1 text-xl font-bold text-ink">{config ? (config.nextNumber - 1).toLocaleString('es-CL') : '—'}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Próximo número configurado</p>
                <p className="mt-1 text-xl font-bold text-ink">{config ? config.nextNumber.toLocaleString('es-CL') : '—'}</p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Próximo número correlativo</label>
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => { setValue(e.target.value); setSaved(false) }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-lg font-bold outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
              />
            </div>
            <p className="rounded-md border-l-4 border-brand bg-brand/5 px-3 py-2 text-xs text-gray-600">
              Solo se permite avanzar el correlativo, nunca retroceder. No se recomienda modificarlo después de la configuración inicial.
            </p>
            {config?.updatedByName && (
              <p className="text-xs text-gray-400">
                Última modificación: {new Date(config.updatedAt).toLocaleString('es-CL')} · {config.updatedByName}
              </p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs font-semibold text-ok-700">✓ Configuración guardada.</p>}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'sm')}>Cerrar</button>
              <button type="button" onClick={submit} disabled={isPending} className={buttonClass('primary', 'sm')}>
                {isPending ? <Spinner size={13} /> : 'Guardar cambio'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
