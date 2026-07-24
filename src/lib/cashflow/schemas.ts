import { z } from 'zod'

const jobTypes = ['requerimiento', 'emergencia', 'preventivo', 'proyecto', 'otro'] as const
const jobStatuses = ['pendiente', 'en_proceso', 'ejecutado', 'anulado'] as const
const collectionStatuses = ['sin_oc', 'pendiente_pago', 'pagado'] as const
const costCategories = ['materiales', 'mano_obra', 'subcontrato', 'transporte', 'otros'] as const

const processFlows = ['pre_quote', 'post_execution'] as const
const commercialStages = ['intake', 'quote_draft', 'quote_sent', 'valuation_pending', 'approved', 'rejected'] as const
const operationalStages = ['pending', 'scheduled', 'in_progress', 'executed', 'client_review', 'closed'] as const
const documentationStages = ['pending', 'partial', 'ready', 'sent'] as const
const financialStages = ['no_po', 'po_requested', 'po_received', 'to_invoice', 'invoiced', 'payment_pending', 'overdue', 'paid'] as const

// Tri-state Sí/No/Sin dato — un checkbox HTML no puede distinguir "no" de
// "sin dato" (ambos son "ausente"), así que estos campos van como <select>.
const triState = z.preprocess(
  (v) => (v === 'si' ? true : v === 'no' ? false : null),
  z.boolean().nullable(),
)

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

  // Flujo de Caja v2 — ver docs/superpowers/specs/2026-07-24-flujo-caja-job-schema-design.md
  processFlow: z.enum(processFlows).default('pre_quote'),
  commercialStage: z.enum(commercialStages).default('intake'),
  operationalStage: z.enum(operationalStages).default('pending'),
  documentationStage: z.enum(documentationStages).default('pending'),
  financialStage: z.enum(financialStages).default('no_po'),
  docOt: triState,
  docPhotos: triState,
  docReport: triState,
  docClientSent: triState,
  rejectionReason: z.string().optional(),
  rejectionDate: z.string().optional(),
  nonBillable: z.coerce.boolean().default(false),
  nonBillableReason: z.string().optional(),
  lastContactDate: z.string().optional(),
  nextContactDate: z.string().optional(),
  contactNote: z.string().optional(),
})

// Edición rápida desde el acordeón de /flujo — subconjunto de jobInput,
// sin navegar a la página de detalle.
export const jobQuickEditInput = z.object({
  quoteRef: z.string().optional(),
  code: z.string().optional(),
  purchaseOrder: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  creditDays: z.coerce.number().int().nonnegative().optional(),
  netAmount: z.coerce.number().int().nonnegative().optional(),
  taxAmount: z.coerce.number().int().nonnegative().optional(),
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
