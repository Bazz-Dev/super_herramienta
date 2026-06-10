'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  computeTotals,
  TEMPLATES,
  TEMPLATE_DESCRIPTIONS,
  TEMPLATE_LABELS,
  type QuoteData,
} from '@/lib/quotes/types'
import { formatMoney } from '@/lib/quotes/format'
import { buildQuoteId } from '@/lib/quotes/quote-id'
import { renderQuoteHTML } from '@/lib/quotes/template'
import { DownloadPdfButton } from './download-pdf-button'
import { ExternalLinkIcon, ImageIcon, RefreshIcon, ZoomInIcon, ZoomOutIcon } from './icons'
import { ImagesEditor } from './images-editor'
import { ItemsEditor } from './items-editor'
import { QuotePreview } from './quote-preview'
import { ScopeEditor } from './scope-editor'
import { StringListEditor } from './string-list-editor'
import { Field, IconButton, NumberInput, SectionCard, Select, TextArea, TextInput } from './ui'

export function QuoteEditor({ initial }: { initial: QuoteData }) {
  const [data, setData] = useState<QuoteData>(initial)
  const set = (patch: Partial<QuoteData>) => setData((d) => ({ ...d, ...patch }))

  const totals = useMemo(() => computeTotals(data), [data])

  const [html, setHtml] = useState(() => renderQuoteHTML(initial))
  useEffect(() => {
    const t = setTimeout(() => setHtml(renderQuoteHTML(data)), 250)
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
        <SectionCard title="Plantilla" description="Elige el formato visual del documento">
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => {
              const active = data.template === t
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ template: t })}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    active ? 'border-brand bg-brand/10' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-sm font-semibold ${active ? 'text-brand-600' : 'text-ink'}`}>
                    {TEMPLATE_LABELS[t]}
                  </div>
                  <div className="text-[11px] text-gray-400">{TEMPLATE_DESCRIPTIONS[t]}</div>
                </button>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard title="Cliente y cabecera">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cliente">
              <TextInput value={data.client.name} onChange={(e) => set({ client: { ...data.client, name: e.target.value } })} />
            </Field>
            <Field label="RUT">
              <TextInput value={data.client.rut ?? ''} onChange={(e) => set({ client: { ...data.client, rut: e.target.value } })} />
            </Field>
            <Field label="Contacto">
              <TextInput value={data.client.contact ?? ''} onChange={(e) => set({ client: { ...data.client, contact: e.target.value } })} />
            </Field>
            <Field label="Fecha">
              <TextInput type="date" value={data.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="N° Cotización">
              <div className="flex gap-1.5">
                <TextInput value={data.quoteId} onChange={(e) => set({ quoteId: e.target.value })} />
                <IconButton
                  label="Regenerar número"
                  onClick={() => set({ quoteId: buildQuoteId({ date: data.date, client: data.client.name }) })}
                >
                  <RefreshIcon />
                </IconButton>
              </div>
            </Field>
            <Field label="Validez (días)">
              <NumberInput value={data.validityDays} min={1} onValue={(n) => set({ validityDays: n })} />
            </Field>
            <Field label="Tagline">
              <TextInput value={data.tagline} onChange={(e) => set({ tagline: e.target.value })} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Resumen ejecutivo">
          <TextArea rows={3} value={data.executiveSummary} placeholder="Describe brevemente el servicio cotizado…" onChange={(e) => set({ executiveSummary: e.target.value })} />
        </SectionCard>

        <SectionCard title="Alcance de trabajo">
          <ScopeEditor items={data.scope} onChange={(scope) => set({ scope })} />
        </SectionCard>

        <SectionCard title="Detalle de precios" description="Los totales se calculan automáticamente">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Field label="Moneda">
              <Select value={data.currency} onChange={(e) => set({ currency: e.target.value as QuoteData['currency'] })}>
                <option value="CLP">CLP ($)</option>
                <option value="UF">UF</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
            <Field label="IVA (%)">
              <NumberInput value={Math.round(data.taxRate * 100)} min={0} max={100} onValue={(n) => set({ taxRate: n / 100 })} />
            </Field>
          </div>
          <ItemsEditor
            items={data.items}
            columns={data.customColumns}
            currency={data.currency}
            onItemsChange={(items) => set({ items })}
            onColumnsChange={(customColumns) => set({ customColumns })}
          />
          <div className="mt-4 ml-auto w-full max-w-xs text-sm">
            <Row label="Neto" value={formatMoney(totals.net, data.currency)} />
            <Row label={`IVA (${Math.round(data.taxRate * 100)}%)`} value={formatMoney(totals.tax, data.currency)} />
            <div className="mt-1 flex justify-between rounded-md bg-ink px-3 py-1.5 font-bold text-brand">
              <span>TOTAL</span>
              <span>{formatMoney(totals.total, data.currency)}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Imágenes" description="Banner de portada y registro fotográfico (opcionales)" icon={<ImageIcon />}>
          <ImagesEditor
            coverImageUrl={data.coverImageUrl}
            images={data.images}
            onCoverChange={(coverImageUrl) => set({ coverImageUrl })}
            onImagesChange={(images) => set({ images })}
          />
        </SectionCard>

        <SectionCard title="Exclusiones">
          <StringListEditor items={data.exclusions} onChange={(exclusions) => set({ exclusions })} addLabel="Agregar exclusión" placeholder="Exclusión" />
        </SectionCard>

        <SectionCard title="Condiciones comerciales">
          <StringListEditor items={data.commercialConditions} onChange={(commercialConditions) => set({ commercialConditions })} addLabel="Agregar condición" placeholder="Condición" />
        </SectionCard>
      </div>

      {/* ---------- Preview (sticky) ---------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-600">Vista previa</span>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">A4 · {TEMPLATE_LABELS[data.template]}</span>
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
            <DownloadPdfButton data={data} />
          </div>
        </div>
        <div className="max-h-[82vh] overflow-auto rounded-lg bg-gray-100 p-3">
          <QuotePreview html={html} zoom={zoom} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-0.5 text-gray-600">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
