'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button, Field, TextInput, Select, TextArea } from '@/components/quotes/ui'
import {
  JOB_TYPE_LABELS,
  PROCESS_FLOW_LABELS,
  COMMERCIAL_STAGE_LABELS,
  OPERATIONAL_STAGE_LABELS,
  DOCUMENTATION_STAGE_LABELS,
  FINANCIAL_STAGE_LABELS,
} from '@/lib/cashflow/labels'
import { toDateInput } from '@/lib/cashflow/dates'
import { ClientSelector } from '@/components/cashflow/client-selector'

type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

type JobInitial = {
  id?: string
  clientId?: string
  branchId?: string
  description?: string
  type?: string
  status?: string
  executionDate?: Date | null
  costCenter?: string | null
  jobNumber?: number | null
  quoteRef?: string | null
  hasTechReport?: boolean
  technicianId?: string | null
  notes?: string | null
  extraNotes?: string | null
  netAmount?: number | null
  taxAmount?: number | null
  purchaseOrder?: string | null
  purchaseOrderDate?: Date | null
  invoiceNumber?: string | null
  invoiceDate?: Date | null
  creditDays?: number | null
  paymentMethodRaw?: string | null
  collectionStatus?: string
  paymentDate?: Date | null
  originTicketId?: string | null
  originProposalId?: string | null
  processFlow?: string
  commercialStage?: string
  operationalStage?: string
  documentationStage?: string
  financialStage?: string
  docOt?: boolean | null
  docPhotos?: boolean | null
  docReport?: boolean | null
  docClientSent?: boolean | null
  rejectionReason?: string | null
  rejectionDate?: Date | null
  nonBillable?: boolean
  nonBillableReason?: string | null
  lastContactDate?: Date | null
  nextContactDate?: Date | null
  contactNote?: string | null
}

function triStateSelect(name: string, value: boolean | null | undefined) {
  const v = value === true ? 'si' : value === false ? 'no' : ''
  return (
    <select name={name} defaultValue={v} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand">
      <option value="">Sin dato</option>
      <option value="si">Sí</option>
      <option value="no">No</option>
    </select>
  )
}

export function JobForm({
  action,
  branches,
  technicians,
  clients = [],
  clientId,
  initial,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  branches: { id: string; name: string }[]
  technicians: { id: string; name: string }[]
  clients?: { id: string; name: string }[]
  clientId: string
  initial?: JobInitial
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const err = (f: string) => state.fieldErrors?.[f]?.[0]

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      {/* Hidden ids */}
      <input type="hidden" name="clientId" value={clientId} />
      {initial?.originTicketId && (
        <input type="hidden" name="originTicketId" value={initial.originTicketId} />
      )}
      {initial?.originProposalId && (
        <input type="hidden" name="originProposalId" value={initial.originProposalId} />
      )}

      {/* --- Identificación --- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Identificación
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {clients.length > 1 && (
            <Field label="Cliente *">
              <ClientSelector clients={clients} currentId={clientId} />
            </Field>
          )}

          <Field label="Sucursal *" hint={err('branchId')}>
            <Select name="branchId" defaultValue={initial?.branchId ?? ''} required>
              <option value="">Seleccionar sucursal…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Descripción *" hint={err('description')}>
            <TextInput
              name="description"
              defaultValue={initial?.description ?? ''}
              required
              placeholder="Ej. Mantención preventiva HVAC"
            />
          </Field>

          <Field label="Tipo">
            <Select name="type" defaultValue={initial?.type ?? 'requerimiento'}>
              {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Fecha de ejecución">
            <TextInput
              name="executionDate"
              type="date"
              defaultValue={toDateInput(initial?.executionDate)}
            />
          </Field>

          <Field label="Centro de costo">
            <TextInput
              name="costCenter"
              defaultValue={initial?.costCenter ?? ''}
              placeholder="CC-001"
            />
          </Field>

          <Field label="N° trabajo">
            <TextInput
              name="jobNumber"
              type="number"
              defaultValue={initial?.jobNumber ?? ''}
              placeholder="123"
            />
          </Field>

          <Field label="Ref. cotización">
            <TextInput
              name="quoteRef"
              defaultValue={initial?.quoteRef ?? ''}
              placeholder="ING-PRO-240101-…"
            />
          </Field>

          <Field label="Técnico responsable">
            <Select name="technicianId" defaultValue={initial?.technicianId ?? ''}>
              <option value="">Sin asignar</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-center gap-2 pt-5">
            <input
              id="hasTechReport"
              type="checkbox"
              name="hasTechReport"
              defaultChecked={initial?.hasTechReport ?? false}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand"
            />
            <label htmlFor="hasTechReport" className="cursor-pointer text-sm text-gray-700">
              Tiene informe técnico
            </label>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field label="Notas">
            <TextArea name="notes" defaultValue={initial?.notes ?? ''} rows={2} placeholder="Observaciones del trabajo…" />
          </Field>
          <Field label="Notas adicionales">
            <TextArea name="extraNotes" defaultValue={initial?.extraNotes ?? ''} rows={2} />
          </Field>
        </div>
      </section>

      {/* --- Ingreso --- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ingreso
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Neto (CLP)">
            <TextInput
              name="netAmount"
              type="number"
              min={0}
              defaultValue={initial?.netAmount ?? ''}
              placeholder="0"
            />
          </Field>
          <Field label="IVA (CLP)">
            <TextInput
              name="taxAmount"
              type="number"
              min={0}
              defaultValue={initial?.taxAmount ?? ''}
              placeholder="Vacío = 19% automático"
            />
          </Field>
        </div>
      </section>

      {/* --- Cobranza --- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Cobranza
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="N° OC">
            <TextInput
              name="purchaseOrder"
              defaultValue={initial?.purchaseOrder ?? ''}
              placeholder="OC-2024-001"
            />
          </Field>
          <Field label="Fecha OC">
            <TextInput
              name="purchaseOrderDate"
              type="date"
              defaultValue={toDateInput(initial?.purchaseOrderDate)}
            />
          </Field>
          <Field label="N° factura">
            <TextInput
              name="invoiceNumber"
              defaultValue={initial?.invoiceNumber ?? ''}
              placeholder="FAC-000123"
            />
          </Field>
          <Field label="Fecha factura">
            <TextInput
              name="invoiceDate"
              type="date"
              defaultValue={toDateInput(initial?.invoiceDate)}
            />
          </Field>
          <Field label="Días de crédito">
            <TextInput
              name="creditDays"
              type="number"
              min={0}
              defaultValue={initial?.creditDays ?? ''}
              placeholder="30"
            />
          </Field>
          <Field label="Forma de pago">
            <TextInput
              name="paymentMethodRaw"
              defaultValue={initial?.paymentMethodRaw ?? ''}
              placeholder="Transferencia, cheque…"
            />
          </Field>
          <Field label="Fecha de pago">
            <TextInput
              name="paymentDate"
              type="date"
              defaultValue={toDateInput(initial?.paymentDate)}
            />
          </Field>
        </div>
      </section>

      {/* --- Estado del trabajo (Flujo de Caja v2) --- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Estado del trabajo
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Origen del trabajo">
            <Select name="processFlow" defaultValue={initial?.processFlow ?? 'pre_quote'}>
              {Object.entries(PROCESS_FLOW_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Etapa comercial">
            <Select name="commercialStage" defaultValue={initial?.commercialStage ?? 'intake'}>
              {Object.entries(COMMERCIAL_STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Etapa operativa">
            <Select name="operationalStage" defaultValue={initial?.operationalStage ?? 'executed'}>
              {Object.entries(OPERATIONAL_STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Documentación">
            <Select name="documentationStage" defaultValue={initial?.documentationStage ?? 'pending'}>
              {Object.entries(DOCUMENTATION_STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Estado financiero">
            <Select name="financialStage" defaultValue={initial?.financialStage ?? 'no_po'}>
              {Object.entries(FINANCIAL_STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>

        <p className="mb-2 mt-4 text-xs font-medium text-gray-500">Checklist de documentos</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="OT">{triStateSelect('docOt', initial?.docOt)}</Field>
          <Field label="Fotos">{triStateSelect('docPhotos', initial?.docPhotos)}</Field>
          <Field label="Informe">{triStateSelect('docReport', initial?.docReport)}</Field>
          <Field label="Enviado al cliente">{triStateSelect('docClientSent', initial?.docClientSent)}</Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Motivo de rechazo">
            <TextInput name="rejectionReason" defaultValue={initial?.rejectionReason ?? ''} placeholder="Solo si la etapa comercial es 'No aprobado'" />
          </Field>
          <Field label="Fecha de rechazo">
            <TextInput name="rejectionDate" type="date" defaultValue={toDateInput(initial?.rejectionDate)} />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            id="nonBillable"
            type="checkbox"
            name="nonBillable"
            defaultChecked={initial?.nonBillable ?? false}
            className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand"
          />
          <label htmlFor="nonBillable" className="cursor-pointer text-sm text-gray-700">
            Cerrado sin cobro (no se factura)
          </label>
        </div>
        <div className="mt-2">
          <Field label="Motivo (si es sin cobro)">
            <TextInput name="nonBillableReason" defaultValue={initial?.nonBillableReason ?? ''} />
          </Field>
        </div>

        <p className="mb-2 mt-4 text-xs font-medium text-gray-500">Seguimiento de cobranza</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Último contacto">
            <TextInput name="lastContactDate" type="date" defaultValue={toDateInput(initial?.lastContactDate)} />
          </Field>
          <Field label="Próximo contacto">
            <TextInput name="nextContactDate" type="date" defaultValue={toDateInput(initial?.nextContactDate)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nota de seguimiento">
              <TextArea name="contactNote" defaultValue={initial?.contactNote ?? ''} rows={2} />
            </Field>
          </div>
        </div>
      </section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : 'Guardar trabajo'}
        </Button>
        <Link href="/flujo" className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
