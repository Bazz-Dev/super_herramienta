'use client'

import { useEffect, useState } from 'react'
import type { ReportData } from '@/lib/reports/types'
import { renderReportHTML } from '@/lib/reports/template'
import { DownloadReportButton } from './download-report-button'
import { ReportPhotosEditor } from './report-photos-editor'
import { ReportPreview } from './report-preview'
import { SectionsEditor } from './sections-editor'
import { ExternalLinkIcon, ImageIcon, ZoomInIcon, ZoomOutIcon } from '@/components/quotes/icons'
import { Field, IconButton, SectionCard, TextArea, TextInput } from '@/components/quotes/ui'

export function ReportEditor({ initial }: { initial: ReportData }) {
  const [data, setData] = useState<ReportData>(initial)
  const set = (patch: Partial<ReportData>) => setData((d) => ({ ...d, ...patch }))

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
            <Field label="Fecha">
              <TextInput type="date" value={data.date} onChange={(e) => set({ date: e.target.value })} />
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-600">Vista previa</span>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">A4 · Informe técnico</span>
          </div>
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
            <DownloadReportButton data={data} />
          </div>
        </div>
        <div className="max-h-[82vh] overflow-auto rounded-lg bg-gray-100 p-3">
          <ReportPreview html={html} zoom={zoom} />
        </div>
      </div>
    </div>
  )
}
