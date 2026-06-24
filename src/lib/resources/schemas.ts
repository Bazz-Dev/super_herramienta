import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v))

export const technicianInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  rut: optionalText,
  specialty: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => v === undefined || z.email().safeParse(v).success, 'Email inválido.'),
  phone: optionalText,
  active: z.boolean().default(true),
  notes: optionalText,
  contractType: z.enum(['indefinido', 'plazo_fijo', 'ayudante']).default('indefinido'),
  contractEndDate: optionalText,
  dailyRate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), 'Tarifa inválida.'),
  birthDate: optionalText,
  emergencyContact: optionalText,
  emergencyPhone: optionalText,
})

export type TechnicianInput = z.infer<typeof technicianInputSchema>

export const vehicleInputSchema = z.object({
  plate: z.string().trim().min(1, 'La patente es obligatoria.'),
  brand: optionalText,
  model: optionalText,
  year: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1950 && v <= 2100), 'Año inválido.'),
  status: z.enum(['active', 'maintenance', 'retired']).default('active'),
  technicianId: optionalText,
  notes: optionalText,
  revTecnicaExpiry: optionalText,
  soapExpiry: optionalText,
  permisoCirculacionExpiry: optionalText,
  lastServiceDate: optionalText,
  nextServiceDate: optionalText,
})
export type VehicleInput = z.infer<typeof vehicleInputSchema>

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  rut: optionalText,
  contact: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => v === undefined || z.email().safeParse(v).success, 'Email inválido.'),
})
export type ClientInput = z.infer<typeof clientInputSchema>

export const assetInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  code: optionalText,
  category: optionalText,
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']).default('available'),
  vehicleId: optionalText, // camioneta a la que pertenece la herramienta
  notes: optionalText,
})
export type AssetInput = z.infer<typeof assetInputSchema>

export const crewInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  description: optionalText,
  active: z.boolean().default(true),
  technicianIds: z.array(z.string()).default([]),
})
export type CrewInput = z.infer<typeof crewInputSchema>

const assigneeSchema = z.object({
  technicianId: z.string().min(1),
  role: z.enum(['tecnico', 'ayudante']).default('tecnico'),
})
export type AssigneeInput = z.infer<typeof assigneeSchema>

export const assignmentInputSchema = z
  .object({
    title: z.string().trim().min(1, 'El título es obligatorio.'),
    description: optionalText,
    start: z.string().min(1, 'La fecha de inicio es obligatoria.'),
    end: z.string().min(1, 'La fecha de término es obligatoria.'),
    status: z.enum(['scheduled', 'in_progress', 'done', 'cancelled']).default('scheduled'),
    permissionRequested: z.boolean().default(false),
    clientId: optionalText,
    meetingUrl: optionalText,
    assignees: z.array(assigneeSchema).default([]),
  })
  .refine((d) => new Date(d.end) >= new Date(d.start), {
    message: 'El término no puede ser anterior al inicio.',
    path: ['end'],
  })
export type AssignmentInput = z.infer<typeof assignmentInputSchema>
