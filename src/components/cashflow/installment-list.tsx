'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Field, TextInput, Select, Button } from '@/components/quotes/ui'
import { Spinner } from '@/components/ui/spinner'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { jobInstallmentsSummary, isInstallmentPaid, installmentDueDate } from '@/lib/cashflow/job-presets'
import { PURCHASE_ORDER_STATUS_LABELS, PURCHASE_ORDER_STATUS_COLORS } from '@/lib/cashflow/labels'
import { addInstallment, updateInstallment, deleteInstallment, setInstallmentsPlanned } from '@/app/(app)/flujo/actions'

type Installment = {
  id: string
  sequence: number
  netAmount: number | null
  purchaseOrder: string | null
  purchaseOrderDate: Date | null
  purchaseOrderFileUrl: string | null
  purchaseOrderStatus: string | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  invoiceFileUrl: string | null
  invoiceStatus: string | null
  creditDays: number | null
  paymentMethodRaw: string | null
  paymentDate: Date | null
  paymentAmount: number | null
  notes: string | null
}

const fieldCls = 'w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

// Cuotas (informe #12): un trabajo se paga en cuotas cuando llegan varias OC
// y facturas separadas en el tiempo. Nunca se exige crear las futuras —
// "Activar" solo fija cuántas se esperan, cada cuota real se agrega cuando
// llega su OC. El saldo total SIEMPRE es la suma de saldos de cuota (nunca
// un campo aparte que pueda desincronizarse).
export function InstallmentList({
  jobId, netAmount, installmentsPlanned, installments,
}: {
  jobId: string
  netAmount: number | null
  installmentsPlanned: number | null
  installments: Installment[]
}) {
  const router = useRouter()
  const [activating, setActivating] = useState(false)
  const [plannedInput, setPlannedInput] = useState(String(installmentsPlanned ?? 3))
  const [adding, setAdding] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isActive = installmentsPlanned != null || installments.length > 0
  const summary = jobInstallmentsSummary(installments)
  const mismatch = netAmount != null && summary.totalNet !== netAmount && installments.length > 0

  function activate() {
    const n = parseInt(plannedInput, 10)
    startTransition(async () => {
      await setInstallmentsPlanned(jobId, isNaN(n) ? null : n)
      router.refresh()
    })
    setActivating(false)
  }

  function deactivate() {
    if (installments.length > 0) {
      window.alert('No se puede desactivar: ya hay cuotas creadas. Elimínalas primero si fue un error.')
      return
    }
    startTransition(async () => {
      await setInstallmentsPlanned(jobId, null)
      router.refresh()
    })
  }

  if (!isActive) {
    return (
      <div>
        <p className="mb-2 text-sm text-gray-500">
          Este trabajo se cobra en un solo pago (OC y factura en la sección Documentos, arriba).
        </p>
        {activating ? (
          <div className="flex items-center gap-2">
            <Field label="N° de cuotas planificadas">
              <TextInput value={plannedInput} onChange={(e) => setPlannedInput(e.target.value)} type="number" min={2} className="w-24" />
            </Field>
            <Button type="button" onClick={activate} disabled={isPending}>Activar</Button>
            <button type="button" onClick={() => setActivating(false)} className="text-sm text-gray-500 hover:underline">Cancelar</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setActivating(true)}
            className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:border-brand hover:text-brand"
          >
            + Activar pago en cuotas
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {installments.length} de {installmentsPlanned ?? installments.length} cuota{(installmentsPlanned ?? installments.length) !== 1 ? 's' : ''} creada{(installmentsPlanned ?? installments.length) !== 1 ? 's' : ''}
        </p>
        {installments.length === 0 && (
          <button type="button" onClick={deactivate} disabled={isPending} className="text-xs text-gray-400 hover:underline">
            Desactivar cuotas
          </button>
        )}
      </div>

      {mismatch && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          La suma de las cuotas ({clp(summary.totalNet)}) no coincide con el total aprobado del trabajo ({clp(netAmount!)}) — revisa antes de cerrar.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {installments.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Aún no hay cuotas creadas — agrega la primera cuando llegue su OC.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">OC</th>
                <th className="px-3 py-2.5 font-medium">Factura</th>
                <th className="px-3 py-2.5 font-medium">Vence</th>
                <th className="px-3 py-2.5 font-medium text-right">Monto</th>
                <th className="px-3 py-2.5 font-medium text-right">Pagado</th>
                <th className="px-3 py-2.5 font-medium text-right">Saldo</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {installments.map((i) => <InstallmentRow key={i.id} installment={i} jobId={jobId} />)}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-4 text-sm">
        <span className="text-gray-500">Total cuotas: <span className="tabular-nums font-medium text-ink">{clp(summary.totalNet)}</span></span>
        <span className={`font-semibold tabular-nums ${summary.balance <= 0 ? 'text-green-700' : 'text-amber-700'}`}>
          Saldo total: {clp(summary.balance)}
        </span>
      </div>

      {adding ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-600">Agregar cuota {installments.length + 1}</h3>
          <form action={addInstallment} onSubmit={() => setAdding(false)} className="flex flex-col gap-3">
            <input type="hidden" name="jobId" value={jobId} />
            <InstallmentFields />
            <div className="flex items-center gap-2">
              <Button type="submit">+ Agregar cuota</Button>
              <button type="button" onClick={() => setAdding(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:border-brand hover:text-brand"
        >
          + Agregar cuota
        </button>
      )}
    </div>
  )
}

function InstallmentFields({ initial }: { initial?: Installment }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Monto (CLP)"><TextInput name="netAmount" type="number" min={0} defaultValue={initial?.netAmount ?? ''} placeholder="0" /></Field>
      <Field label="N° OC"><TextInput name="purchaseOrder" defaultValue={initial?.purchaseOrder ?? ''} placeholder="OC-2024-001" /></Field>
      <Field label="Fecha OC"><TextInput name="purchaseOrderDate" type="date" defaultValue={toDateInput(initial?.purchaseOrderDate)} /></Field>
      <Field label="Estado OC">
        <Select name="purchaseOrderStatus" defaultValue={initial?.purchaseOrderStatus ?? ''}>
          <option value="">Sin definir</option>
          {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="N° factura"><TextInput name="invoiceNumber" defaultValue={initial?.invoiceNumber ?? ''} placeholder="FAC-000123" /></Field>
      <Field label="Fecha factura"><TextInput name="invoiceDate" type="date" defaultValue={toDateInput(initial?.invoiceDate)} /></Field>
      <Field label="Estado factura">
        <Select name="invoiceStatus" defaultValue={initial?.invoiceStatus ?? ''}>
          <option value="">Sin definir</option>
          {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Días de crédito"><TextInput name="creditDays" type="number" min={0} defaultValue={initial?.creditDays ?? ''} placeholder="30" /></Field>
      <Field label="Condiciones de pago"><TextInput name="paymentMethodRaw" defaultValue={initial?.paymentMethodRaw ?? ''} placeholder="Transferencia, cheque…" /></Field>
      <Field label="Fecha de pago"><TextInput name="paymentDate" type="date" defaultValue={toDateInput(initial?.paymentDate)} /></Field>
      <Field label="Monto pagado"><TextInput name="paymentAmount" type="number" min={0} defaultValue={initial?.paymentAmount ?? ''} placeholder="0" /></Field>
      <Field label="Notas"><TextInput name="notes" defaultValue={initial?.notes ?? ''} /></Field>
    </div>
  )
}

// Adjuntar/reemplazar/quitar el archivo de la OC o factura de ESTA cuota —
// mismo endpoint que Job (informe #11 lo extiende con installmentId), fuera
// del <form> de texto porque es su propia operación independiente (mismo
// criterio que OwnedDocSlot en job-document-slots.tsx para el Job).
function InstallmentDocButton({
  jobId, installmentId, docField, fileUrl, onDone,
}: {
  jobId: string
  installmentId: string
  docField: 'purchaseOrder' | 'invoice'
  fileUrl: string | null
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('docField', docField)
    fd.set('installmentId', installmentId)
    const res = await fetch(`/api/flujo/trabajos/${jobId}/documents`, { method: 'POST', body: fd })
    setBusy(false)
    if (res.ok) onDone()
  }

  async function onUnlink() {
    if (!confirm('¿Quitar el archivo adjunto? El número registrado se mantiene.')) return
    setBusy(true)
    const res = await fetch(`/api/flujo/trabajos/${jobId}/documents`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docField, installmentId }),
    })
    setBusy(false)
    if (res.ok) onDone()
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px]">
      {fileUrl && (
        <a href={`/api/files?key=${encodeURIComponent(fileUrl)}&type=job`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
          Ver
        </a>
      )}
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="font-semibold text-brand hover:underline disabled:opacity-50">
        {busy ? '…' : fileUrl ? 'Reemplazar' : 'Adjuntar'}
      </button>
      {fileUrl && (
        <button type="button" disabled={busy} onClick={onUnlink} className="font-semibold text-red-500 hover:underline disabled:opacity-50">
          Quitar
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
    </span>
  )
}

function InstallmentRow({ installment: i, jobId }: { installment: Installment; jobId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  // Lazy initializer: se evalúa una sola vez al montar, no en cada render
  // (Date.now() directo en el cuerpo del componente viola la regla de
  // pureza de render de React).
  const [now] = useState(() => Date.now())
  const paid = isInstallmentPaid(i)
  const balance = (i.netAmount ?? 0) - (i.paymentAmount ?? 0)
  const due = installmentDueDate(i)
  const overdue = !paid && due != null && due.getTime() < now

  function handleDelete() {
    if (!window.confirm(`¿Eliminar la cuota ${i.sequence}?`)) return
    startTransition(async () => {
      await deleteInstallment(i.id, jobId)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <tr className="border-b border-gray-100 bg-brand/5">
        <td colSpan={8} className="p-3">
          <form
            action={(fd) => updateInstallment(i.id, fd)}
            onSubmit={() => setEditing(false)}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="jobId" value={jobId} />
            <InstallmentFields initial={i} />
            <div className="flex items-center gap-2">
              <Button type="submit">Guardar cuota {i.sequence}</Button>
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
            </div>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <td className="px-3 py-2.5 font-medium text-gray-700">{i.sequence}</td>
      <td className="px-3 py-2.5 text-gray-600">
        <div>{i.purchaseOrder ?? '—'}</div>
        {i.purchaseOrderStatus && (
          <span className={`mb-1 inline-block rounded border px-1 py-0.5 text-[9px] font-semibold ${PURCHASE_ORDER_STATUS_COLORS[i.purchaseOrderStatus] ?? ''}`}>
            {PURCHASE_ORDER_STATUS_LABELS[i.purchaseOrderStatus] ?? i.purchaseOrderStatus}
          </span>
        )}
        {i.purchaseOrder && (
          <div className="mt-0.5">
            <InstallmentDocButton jobId={jobId} installmentId={i.id} docField="purchaseOrder" fileUrl={i.purchaseOrderFileUrl} onDone={() => router.refresh()} />
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-gray-600">
        <div>{i.invoiceNumber ?? '—'}</div>
        {i.invoiceStatus && (
          <span className={`mb-1 inline-block rounded border px-1 py-0.5 text-[9px] font-semibold ${PURCHASE_ORDER_STATUS_COLORS[i.invoiceStatus] ?? ''}`}>
            {PURCHASE_ORDER_STATUS_LABELS[i.invoiceStatus] ?? i.invoiceStatus}
          </span>
        )}
        {i.invoiceNumber && (
          <div className="mt-0.5">
            <InstallmentDocButton jobId={jobId} installmentId={i.id} docField="invoice" fileUrl={i.invoiceFileUrl} onDone={() => router.refresh()} />
          </div>
        )}
      </td>
      <td className={`px-3 py-2.5 ${overdue ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
        {due ? toDateInput(due) : '—'}{overdue && ' · vencida'}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{i.netAmount != null ? clp(i.netAmount) : '—'}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{i.paymentAmount != null ? clp(i.paymentAmount) : '—'}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${paid ? 'text-green-700' : 'text-ink'}`}>
        {paid ? 'Pagada' : clp(balance)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-brand hover:underline">Editar</button>
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            aria-label={`Eliminar cuota ${i.sequence}`}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-gray-400 transition-colors duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            {pending ? <Spinner size={12} /> : '×'}
          </button>
        </div>
      </td>
    </tr>
  )
}
