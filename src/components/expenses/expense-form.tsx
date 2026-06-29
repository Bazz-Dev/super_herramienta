'use client'

import { useRef, useState, useTransition, type ChangeEvent } from 'react'
import { createExpense } from '@/app/(app)/gastos/actions'

const CATEGORY_LABELS: Record<string, string> = {
  combustible: 'Combustible',
  estacionamiento: 'Estacionamiento',
  materiales: 'Materiales',
  viatico: 'Viático',
  herramienta: 'Herramienta',
  otro: 'Otro',
}

interface Ticket {
  id: string
  ticketCode: string
  title: string
}

interface ExpenseFormProps {
  /** Provided when a staff member submits on behalf of a technician */
  technicianId?: string
  tickets?: Ticket[]
  onSuccess?: () => void
  compact?: boolean
}

export function ExpenseForm({ technicianId, tickets = [], onSuccess, compact = false }: ExpenseFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [receiptDataUri, setReceiptDataUri] = useState<string | null>(null)
  const [receiptName, setReceiptName] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo no puede superar 5 MB')
      e.target.value = ''
      return
    }
    setReceiptName(file.name)
    const reader = new FileReader()
    reader.onload = () => setReceiptDataUri(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleSubmit(fd: FormData) {
    if (technicianId) fd.set('technicianId', technicianId)
    if (receiptDataUri) fd.set('receiptUrl', receiptDataUri)

    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await createExpense(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setReceiptDataUri(null)
        setReceiptName(null)
        formRef.current?.reset()
        onSuccess?.()
      }
    })
  }

  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand'

  return (
    <form ref={formRef} action={handleSubmit} className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-4 sm:grid-cols-2'}>
        {/* Category */}
        <div>
          <label className={labelClass} htmlFor="ef-category">Categoría</label>
          <select id="ef-category" name="category" className={inputClass} required>
            {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className={labelClass} htmlFor="ef-amount">Monto (CLP)</label>
          <input
            id="ef-amount"
            name="amount"
            type="number"
            min="1"
            step="1"
            placeholder="0"
            className={inputClass}
            required
          />
        </div>

        {/* Date */}
        <div>
          <label className={labelClass} htmlFor="ef-date">Fecha</label>
          <input
            id="ef-date"
            name="date"
            type="date"
            defaultValue={today}
            className={inputClass}
            required
          />
        </div>

        {/* Ticket (optional) */}
        {tickets.length > 0 && (
          <div>
            <label className={labelClass} htmlFor="ef-ticket">Trabajo (opcional)</label>
            <select id="ef-ticket" name="ticketId" className={inputClass}>
              <option value="">— Sin asociar —</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>{t.ticketCode} — {t.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className={labelClass} htmlFor="ef-desc">Descripción</label>
        <textarea
          id="ef-desc"
          name="description"
          rows={2}
          placeholder="Ej: Carga de combustible para traslado a faena…"
          className={inputClass}
        />
      </div>

      {/* Receipt upload */}
      <div>
        <label className={labelClass} htmlFor="ef-receipt">Comprobante (imagen o PDF, máx. 5 MB)</label>
        <input
          id="ef-receipt"
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-brand/20 cursor-pointer"
        />
        {receiptName && (
          <p className="mt-1 text-xs text-gray-500">Archivo seleccionado: {receiptName}</p>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Gasto registrado correctamente.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand/80 disabled:opacity-60 cursor-pointer"
      >
        {isPending ? 'Enviando…' : 'Registrar gasto'}
      </button>
    </form>
  )
}
