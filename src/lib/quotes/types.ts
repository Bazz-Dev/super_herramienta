import { z } from 'zod'

// Data model for a quote ("cotización"). A4 paginated, multi-template.

export const TEMPLATES = ['clasico', 'pro'] as const
export type TemplateId = (typeof TEMPLATES)[number]

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  clasico: 'Clásico',
  pro: 'Pro',
}

export const TEMPLATE_DESCRIPTIONS: Record<TemplateId, string> = {
  clasico: 'Bandas de sección, presentación formal',
  pro: 'Hero negro, grilla meta, condiciones en tabla — ideal para contratos multi-sucursal',
}

export const quoteImageSchema = z.object({
  url: z.string().min(1),
  caption: z.string().default(''),
})

// Margins/adjustments applied to the item base, before neto.
export const adjustmentSchema = z.object({
  key: z.string(),
  label: z.string(),
  percent: z.number(),
  enabled: z.boolean().default(false),
})

export function defaultAdjustments() {
  return [
    { key: 'utilidad', label: 'Utilidad', percent: 7, enabled: false },
    { key: 'gastos_admin', label: 'Gastos administrativos', percent: 3, enabled: false },
    { key: 'ajuste_comercial', label: 'Ajuste comercial de cierre', percent: 0, enabled: false },
  ]
}

export const customColumnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
})

export const quoteItemSchema = z.object({
  description: z.string().min(1),
  detail: z.string().optional(),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  // Values for user-defined columns, keyed by custom column id.
  custom: z.record(z.string(), z.string()).default({}),
})

export const quoteChipSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
})

export const quoteScopeSchema = z.object({
  title: z.string().min(1),
  detail: z.string().default(''),
})

export const quoteDataSchema = z.object({
  template: z.enum(TEMPLATES).default('clasico'),
  coverImageUrl: z.string().optional(), // optional banner image on the cover
  images: z.array(quoteImageSchema).default([]), // optional photo annex

  quoteId: z.string().min(1), // ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]
  date: z.string().min(1),
  validityDays: z.number().int().positive().default(30),

  client: z.object({
    name: z.string().min(1),
    contact: z.string().optional(),
    rut: z.string().optional(),
  }),

  tagline: z.string().default('Ingeniería y Gestión de Activos'),

  executiveSummary: z.string().default(''),
  scope: z.array(quoteScopeSchema).default([]),

  customColumns: z.array(customColumnSchema).default([]),
  items: z.array(quoteItemSchema).default([]),

  adjustments: z.array(adjustmentSchema).default(defaultAdjustments),

  currency: z.enum(['CLP', 'UF', 'USD']).default('CLP'),
  taxRate: z.number().min(0).max(1).default(0.19), // IVA Chile 19%

  exclusions: z.array(z.string().min(1)).default([]),
  commercialConditions: z.array(z.string().min(1)).default([]),

  contact: z
    .object({
      company: z.string().default('INGEGAR SpA'),
      email: z.string().default('contacto@ingegarchile.cl'),
      phone: z.string().optional(),
      web: z.string().default('ingegarchile.cl'),
    })
    .default({ company: 'INGEGAR SpA', email: 'contacto@ingegarchile.cl', web: 'ingegarchile.cl' }),
})

export type CustomColumn = z.infer<typeof customColumnSchema>
export type QuoteImage = z.infer<typeof quoteImageSchema>
export type Adjustment = z.infer<typeof adjustmentSchema>
export type QuoteItem = z.infer<typeof quoteItemSchema>
export type QuoteChip = z.infer<typeof quoteChipSchema>
export type QuoteScope = z.infer<typeof quoteScopeSchema>
export type QuoteData = z.infer<typeof quoteDataSchema>

export type AdjustmentLine = { label: string; percent: number; amount: number }

export type QuoteTotals = {
  base: number
  adjustments: AdjustmentLine[]
  net: number
  tax: number
  total: number
}

// Round monetary amounts to the precision appropriate for each currency.
// CLP: nearest peso (integer). UF: 4 decimal places. USD: 2 decimal places.
function roundByCurrency(value: number, currency: QuoteData['currency']): number {
  if (currency === 'UF') return Math.round(value * 10_000) / 10_000
  if (currency === 'USD') return Math.round(value * 100) / 100
  return Math.round(value)
}

export function computeTotals(data: QuoteData): QuoteTotals {
  const round = (v: number) => roundByCurrency(v, data.currency)
  const base = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  const adjustments: AdjustmentLine[] = (data.adjustments ?? [])
    .filter((a) => a.enabled)
    .map((a) => ({ label: a.label, percent: a.percent, amount: round((base * a.percent) / 100) }))
  const net = base + adjustments.reduce((s, a) => s + a.amount, 0)
  const tax = round(net * data.taxRate)
  return { base, adjustments, net, tax, total: net + tax }
}
