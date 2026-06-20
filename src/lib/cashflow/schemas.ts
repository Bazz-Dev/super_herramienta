import { z } from 'zod'

const jobTypes = ['requerimiento', 'emergencia', 'preventivo', 'proyecto', 'otro'] as const
const jobStatuses = ['pendiente', 'en_proceso', 'ejecutado', 'anulado'] as const
const collectionStatuses = ['sin_oc', 'pendiente_pago', 'pagado'] as const
const costCategories = ['materiales', 'mano_obra', 'subcontrato', 'transporte', 'otros'] as const

export const branchInput = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, 'El nombre es obligatorio'),
  active: z.boolean().default(true),
})

export const jobInput = z.object({
  clientId: z.string().min(1),
  branchId: z.string().min(1, 'La sucursal es obligatoria'),
  description: z.string().min(1, 'La descripción es obligatoria'),
  type: z.enum(jobTypes).default('requerimiento'),
  status: z.enum(jobStatuses).default('ejecutado'),
  executionDate: z.string().optional(),
  costCenter: z.string().optional(),
  jobNumber: z.coerce.number().int().optional(),
  quoteRef: z.string().optional(),
  hasTechReport: z.coerce.boolean().default(false), // checkbox: "on"/absent → true/false (absent must default)
  technicianId: z.string().optional(),
  notes: z.string().optional(),
  extraNotes: z.string().optional(),
  netAmount: z.coerce.number().int().nonnegative().optional(),
  taxAmount: z.coerce.number().int().nonnegative().optional(),
  purchaseOrder: z.string().optional(),
  purchaseOrderDate: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  creditDays: z.coerce.number().int().nonnegative().optional(),
  paymentMethodRaw: z.string().optional(),
  collectionStatus: z.enum(collectionStatuses).default('sin_oc'),
  paymentDate: z.string().optional(),
})

export const jobCostInput = z.object({
  jobId: z.string().min(1),
  category: z.enum(costCategories).default('materiales'),
  description: z.string().optional(),
  amount: z.coerce.number().int().nonnegative(),
  date: z.string().optional(),
  supplier: z.string().optional(),
  documentRef: z.string().optional(),
})

export type BranchInput = z.infer<typeof branchInput>
export type JobInput = z.infer<typeof jobInput>
export type JobCostInput = z.infer<typeof jobCostInput>
