'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  computeTotals,
  TEMPLATES,
  TEMPLATE_LABELS,
  type QuoteData,
} from '@/lib/quotes/types'
import { formatMoney } from '@/lib/quotes/format'
import { buildQuoteId } from '@/lib/quotes/quote-id'
import { renderQuoteHTML } from '@/lib/quotes/template'
import { CoverImageUpload } from './cover-image-upload'
import { DownloadPdfButton } from './download-pdf-button'
import { ItemsEditor } from './items-editor'
import { QuotePreview } from './quote-preview'
import { ScopeEditor } from './scope-editor'
import { StringListEditor } from './string-list-editor'
import { Field, NumberInput, SectionCard, Select, TextArea, TextInput, IconButton } from './ui'

export function QuoteEditor({ initial }: { initial: QuoteData }) {
  const [data, setData] = useState<QuoteData>(initial)
  const set = (patch: Partial<QuoteData>) => setData((d) => ({ ...d, ...patch }))

  const totals = useMemo(() => computeTotals(data), [data])

  // Debounced live preview (re-render the iframe HTML ~250ms after edits).
  const [html, setHtml] = useState(() => renderQuoteHTML(initial))
  useEffect(() => {
    const t = setTimeout(() => setHtml(renderQuoteHTML(data)), 250)
    return () => clearTimeout(t)
  }, [data])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* ---------- Editor ---------- */}
      <div className="flex flex-col gap-4">
        <SectionCard title="Plantilla">
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set({ template: t })}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                  data.template === t
                    ? 'border-brand bg-brand/10 text-brand-600'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {TEMPLATE_LABELS[t]}
              </button>
            ))}
          </div>
          {data.template === 'imagen-hd' && (
            <div className="mt-3">
              <CoverImageUpload value={data.coverImageUrl} onChange={(url) => set({ coverImageUrl: url })} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Cliente y cabecera">
          <div className="grid grid-cols-2 gap-3">
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
              <div className="flex gap-1">
                <TextInput value={data.quoteId} onChange={(e) => set({ quoteId: e.target.value })} />
                <IconButton
                  onClick={() => set({ quoteId: buildQuoteId({ date: data.date, client: data.client.name }) })}
                  title="Regenerar"
                >
                  ↻
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
          <TextArea rows={3} value={data.executiveSummary} onChange={(e) => set({ executiveSummary: e.target.value })} />
        </SectionCard>

        <SectionCard title="Alcance de trabajo">
          <ScopeEditor items={data.scope} onChange={(scope) => set({ scope })} />
        </SectionCard>

        <SectionCard title="Detalle de precios">
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
          <div className="mt-4 ml-auto w-64 text-sm">
            <Row label="Neto" value={formatMoney(totals.net, data.currency)} />
            <Row label={`IVA (${Math.round(data.taxRate * 100)}%)`} value={formatMoney(totals.tax, data.currency)} />
            <div className="mt-1 flex justify-between rounded bg-ink px-2 py-1 font-bold text-brand">
              <span>TOTAL</span>
              <span>{formatMoney(totals.total, data.currency)}</span>
            </div>
          </div>
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
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">Vista previa</span>
          <DownloadPdfButton data={data} />
        </div>
        <div className="max-h-[80vh] overflow-auto rounded-lg bg-gray-100 p-3">
          <QuotePreview html={html} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-2 py-0.5 text-gray-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
