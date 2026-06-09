import { z } from 'zod'

// Data model for a quote ("cotización"). Mirrors the fixed page structure
// defined in DESIGN-SYSTEM.MD (portada → resumen → alcance → precios →
// exclusiones → condiciones → firma → footer).

export const quoteItemSchema = z.object({
  description: z.string().min(1),
  detail: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
})

export const quoteChipSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
})

export const quoteScopeSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
})

export const quoteDataSchema = z.object({
  quoteId: z.string().min(1), // ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]
  date: z.string().min(1), // ISO or display date
  validityDays: z.number().int().positive().default(30),

  client: z.object({
    name: z.string().min(1),
    contact: z.string().optional(),
    rut: z.string().optional(),
  }),

  tagline: z.string().default('Ingeniería y Gestión de Activos'),
  chips: z.array(quoteChipSchema).max(4).default([]),

  executiveSummary: z.string().min(1),
  scope: z.array(quoteScopeSchema).min(1),
  items: z.array(quoteItemSchema).min(1),

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
