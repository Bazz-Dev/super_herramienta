import { z } from 'zod'

// Data model for a quote ("cotización"). A4 paginated, multi-template.

export const TEMPLATES = ['minimal', 'clasico', 'imagen-hd'] as const
export type TemplateId = (typeof TEMPLATES)[number]

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  minimal: 'Minimal',
  clasico: 'Clásico',
  'imagen-hd': 'Imagen HD',
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
  coverImageUrl: z.string().optional(), // for the "imagen-hd" template

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
export type QuoteItem = z.infer<typeof quoteItemSchema>
export type QuoteChip = z.infer<typeof quoteChipSchema>
export type QuoteScope = z.infer<typeof quoteScopeSchema>
export type QuoteData = z.infer<typeof quoteDataSchema>

export type QuoteTotals = {
  net: number
  tax: number
  total: number
}

export function computeTotals(data: QuoteData): QuoteTotals {
  const net = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  const tax = Math.round(net * data.taxRate)
  return { net, tax, total: net + tax }
}
