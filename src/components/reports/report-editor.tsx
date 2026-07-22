'use client'

import { useEffect, useState } from 'react'
import type { ReportData } from '@/lib/reports/types'
import { renderReportHTML } from '@/lib/reports/template'
import { fileToDataUrl } from '@/lib/quotes/image-data-url'
import { DownloadReportButton } from './download-report-button'
import { SaveDocumentButton } from '@/components/quotes/save-document-button'
import { ReportPhotosEditor } from './report-photos-editor'
import { ReportPreview } from './report-preview'
import { SectionsEditor } from './sections-editor'
import { ExternalLinkIcon, ImageIcon, PlusIcon, TrashIcon, ZoomInIcon, ZoomOutIcon } from '@/components/quotes/icons'
import { Field, IconButton, SectionCard, TextArea, TextInput } from '@/components/quotes/ui'

interface ClientOption { id: string; name: string }
interface TicketOption {
  id: string; ticketCode: string; title: string
  otNumber: string | null; otFileUrl: string | null; clientId: string; clientName: string; branchName: string
}

export function ReportEditor({ initial, clients = [], tickets = [], docId, ticketId }: { initial: ReportData; clients?: ClientOption[]; tickets?: TicketOption[]; docId?: string; ticketId?: string }) {
  // Derive initial ticket selection synchronously so SaveDocumentButton gets the right clientId on first render
  const initialTicket = ticketId ? tickets.find(t => t.id === ticketId) : undefined

  // Auto-fill form fields when coming from a ticket link — folded into the
  // initial state itself (was a mount-only effect) so there's no flash of
  // unfilled fields before the effect ran.
  const [data, setData] = useState<ReportData>(() => (
    initialTicket
      ? { ...initial, client: initialTicket.clientName, branch: initialTicket.branchName, workOrder: initialTicket.otNumber ?? '', subject: initialTicket.title }
      : initial
  ))
  const set = (patch: Partial<ReportData>) => setData((d) => ({ ...d, ...patch }))

  const [selectedTicketId, setSelectedTicketId] = useState(initialTicket?.id ?? '')
  const [selectedClientId, setSelectedClientId] = useState(initialTicket?.clientId ?? '')

  // OT (orden de trabajo): los técnicos la escanean en terreno como PDF —
  // ese PDF original se guarda tal cual en el ticket (visible/descargable
  // desde ahí); acá solo se pide una versión en imagen (vía ?as=image, que
  // rasteriza la página 1 si hace falta) porque Chromium no puede incrustar
  // un PDF dentro de otro PDF al generar el informe. Si el ticket ya tiene
  // OT guardada se carga sola; si no, se puede adjuntar aquí mismo.
  const [otBusy, setOtBusy] = useState(false)
  const [otError, setOtError] = useState<string | null>(null)
  const [otIsPdf, setOtIsPdf] = useState(false)

  async function fetchOTAsDataUrl(ticketId: string, isPdf: boolean) {
    const res = await fetch(`/api/tickets/${ticketId}/ot-photo?as=image`)
    if (!res.ok) throw new Error()
    const blob = await res.blob()
    const file = new File([blob], isPdf ? 'ot.png' : 'ot.jpg', { type: blob.type || 'image/png' })
    set({ otImageUrl: await fileToDataUrl(file) })
    setOtIsPdf(isPdf)
  }

  async function loadTicketOT(ticket: TicketOption | undefined) {
    if (!ticket?.otFileUrl) { set({ otImageUrl: '' }); setOtIsPdf(false); return }
    setOtBusy(true)
    setOtError(null)
    try {
      await fetchOTAsDataUrl(ticket.id, ticket.otFileUrl.toLowerCase().endsWith('.pdf'))
    } catch {
      setOtError('No se pudo cargar la OT guardada en el ticket.')
    } finally {
      setOtBusy(false)
    }
  }

  async function attachOTFile(file: File) {
    const isPdf = file.type === 'application/pdf'
    if (isPdf && !selectedTicketId) {
      setOtError('Selecciona un ticket primero para adjuntar la OT en PDF.')
      return
    }
    setOtBusy(true)
    setOtError(null)

    if (!isPdf && !selectedTicketId) {
      // Sin ticket vinculado, una imagen se puede usar directo en este informe
      // (no hay dónde persistirla para la próxima vez).
      try {
        set({ otImageUrl: await fileToDataUrl(file) })
        setOtIsPdf(false)
      } catch (e) {
        setOtError(e instanceof Error ? e.message : 'No se pudo procesar la imagen.')
      }
      setOtBusy(false)
      return
    }

    const fd = new FormData()
    fd.set('file', file)
    const uploadRes = await fetch(`/api/tickets/${selectedTicketId}/ot-photo`, { method: 'POST', body: fd }).catch(() => null)
    if (!uploadRes?.ok) {
      setOtError('No se pudo subir la OT al ticket.')
      setOtBusy(false)
      return
    }
    try {
      await fetchOTAsDataUrl(selectedTicketId, isPdf)
    } catch {
      setOtError('La OT quedó guardada en el ticket, pero no se pudo generar la vista previa.')
    } finally {
      setOtBusy(false)
    }
  }

  // Carga la foto de la OT desde el ticket vinculado (fetch a R2 vía la API) — external-system
  // read, igual categoría que portal-login-form.tsx (localStorage) y portal-ticket-list.tsx
  // (matchMedia): debe ejecutarse post-mount, no se puede resolver en el useState inicial.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-system read (fetch a R2), ver comentario arriba
    if (initialTicket) loadTicketOT(initialTicket)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [html, setHtml] = useState(() => renderReportHTML(initial))
  useEffect(() => {
    const t = setTimeout(() => setHtml(renderReportHTML(data)), 250)
    return () => clearTimeout(t)
  }, [data])

  const [zoom, setZoom] = useState(1)
  function openInTab() {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
      {/* ---------- Editor ---------- */}
      <div className="flex flex-col gap-4">
        <SectionCard title="Identificación" description="Datos de cabecera del informe">
          {/* Ticket link — autocompletes client, branch and OT */}
          {tickets.length > 0 && (
            <div className="mb-4 rounded-lg border border-brand/20 bg-brand/5 p-3">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Vincular a ticket existente
                <span className="ml-1.5 font-normal text-gray-400">(autocompletará cliente, sucursal y OT)</span>
              </label>
              <select
                value={selectedTicketId}
                onChange={(e) => {
                  setSelectedTicketId(e.target.value)
                  const t = tickets.find(t => t.id === e.target.value)
                  if (!t) { setSelectedClientId(''); set({ otImageUrl: '' }); return }
                  setSelectedClientId(t.clientId)
                  set({
                    client: t.clientName,
                    branch: t.branchName,
                    workOrder: t.otNumber ?? '',
                    subject: t.title,
                  })
                  loadTicketOT(t)
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="">— Seleccionar ticket (opcional) —</option>
                {tickets.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.ticketCode} · {t.title}{t.otNumber ? ` (OT: ${t.otNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="N° / Código de reporte">
              <TextInput value={data.reportId} onChange={(e) => set({ reportId: e.target.value })} />
            </Field>
            <Field label="Versión">
              <TextInput value={data.version} onChange={(e) => set({ version: e.target.value })} />
            </Field>
            <Field label="Contacto (responsable)">
              <TextInput value={data.contact} onChange={(e) => set({ contact: e.target.value })} />
            </Field>
            <Field label="Cliente">
              <TextInput value={data.client} onChange={(e) => set({ client: e.target.value })} />
            </Field>
            <Field label="Sucursal">
              <TextInput value={data.branch} onChange={(e) => set({ branch: e.target.value })} />
            </Field>
            <Field label="N° Orden de Trabajo (opcional)">
              <TextInput value={data.workOrder} onChange={(e) => set({ workOrder: e.target.value })} />
            </Field>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">
              Orden de trabajo (OT)
              <span className="ml-1.5 font-normal text-gray-400">(se agrega como última página del informe)</span>
            </label>
            {otBusy && !data.otImageUrl ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-500">
                Procesando…
              </div>
            ) : data.otImageUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.otImageUrl} alt="Orden de trabajo" className="h-16 w-16 rounded object-cover" />
                <span className="flex-1 text-xs text-gray-500">
                  {otIsPdf ? 'PDF escaneado' : 'Foto'} · se incluirá al final del PDF.
                </span>
                <IconButton label="Quitar OT" onClick={() => { set({ otImageUrl: '' }); setOtIsPdf(false) }}>
                  <TrashIcon />
                </IconButton>
              </div>
            ) : (
              <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-150 hover:border-brand hover:text-brand-600">
                <PlusIcon /> {otBusy ? 'Procesando…' : 'Adjuntar OT (PDF o foto)'}
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={otBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) attachOTFile(file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
            {otError && <p className="mt-1 text-xs text-red-600">{otError}</p>}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="Dirección">
              <TextInput value={data.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <Field label="Observación / asunto">
              <TextInput value={data.subject} onChange={(e) => set({ subject: e.target.value })} />
            </Field>
            <Field label="Línea introductoria (opcional)">
              <TextInput value={data.intro} onChange={(e) => set({ intro: e.target.value })} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Secciones del informe" description="Numeradas automáticamente; arrastra el orden con las flechas">
          <SectionsEditor sections={data.sections} onChange={(sections) => set({ sections })} />
        </SectionCard>

        <SectionCard title="Registro fotográfico" description="Fotos del trabajo en terreno" icon={<ImageIcon />}>
          <ReportPhotosEditor photos={data.photos} onChange={(photos) => set({ photos })} />
        </SectionCard>

        <SectionCard title="Datos de contacto (pie)" description="Aparecen en el pie del documento">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Empresa">
              <TextInput value={data.company} onChange={(e) => set({ company: e.target.value })} />
            </Field>
            <Field label="RUT">
              <TextInput value={data.rut} onChange={(e) => set({ rut: e.target.value })} />
            </Field>
            <Field label="Email">
              <TextInput value={data.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Teléfono">
              <TextInput value={data.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Web">
              <TextInput value={data.web} onChange={(e) => set({ web: e.target.value })} />
            </Field>
          </div>
        </SectionCard>
      </div>

      {/* ---------- Preview (sticky) ---------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-ink">Vista previa</span>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">A4 · Informe técnico</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <IconButton label="Reducir zoom" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>
                <ZoomOutIcon />
              </IconButton>
              <span className="w-10 text-center text-xs tabular-nums text-gray-500">{Math.round(zoom * 100)}%</span>
              <IconButton label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
                <ZoomInIcon />
              </IconButton>
              <IconButton label="Abrir en pestaña nueva" onClick={openInTab}>
                <ExternalLinkIcon />
              </IconButton>
            </div>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <DownloadReportButton data={data} />
              <SaveDocumentButton
                clients={clients}
                dataJson={() => data}
                defaultTitle={data.reportId ? `Informe ${data.reportId}` : 'Informe Técnico'}
                documentType="informe"
                existingDocId={docId}
                ticketId={ticketId}
                defaultClientId={selectedClientId}
              />
            </div>
          </div>
        </div>
        <div className="max-h-[82vh] overflow-auto rounded-lg bg-gray-100 p-3">
          <ReportPreview html={html} zoom={zoom} />
        </div>
      </div>
    </div>
  )
}
