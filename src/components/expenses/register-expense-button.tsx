'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/resources/modal'
import { ExpenseForm } from './expense-form'

// Reemplaza el link "Registrar gasto →" que sacaba al usuario a /gastos con
// un ticketRef sin usar (informe #14, cierre): ahora se ingresa acá mismo,
// en la ficha del ticket — /gastos pasa a ser solo lectura. Mismo
// createExpense() de siempre, mismo ExpenseForm, solo cambia dónde vive el
// trigger — sin lógica de negocio nueva.
export function RegisterExpenseButton({
  ticketId, ticketCode, title, technicians,
}: {
  ticketId: string
  ticketCode: string
  title: string
  technicians: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id ?? '')

  function handleSuccess() {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-medium cursor-pointer"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
        Registrar gasto →
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar gasto">
        {technicians.length === 0 ? (
          <p className="text-sm text-gray-500">No hay técnicos activos para asociar el gasto.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="reg-exp-tech">
                Técnico
              </label>
              <select
                id="reg-exp-tech"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
              >
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <ExpenseForm
              technicianId={technicianId}
              lockedTicket={{ id: ticketId, ticketCode, title }}
              onSuccess={handleSuccess}
            />
          </div>
        )}
      </Modal>
    </>
  )
}
