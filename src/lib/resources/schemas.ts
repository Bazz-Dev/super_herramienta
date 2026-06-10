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
  vehiclePlate: optionalText,
  active: z.boolean().default(true),
  notes: optionalText,
})

export type TechnicianInput = z.infer<typeof technicianInputSchema>

export const assetInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  code: optionalText,
  category: optionalText,
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']).default('available'),
  holderId: optionalText, // técnico/camioneta al que se asigna
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

export const assignmentInputSchema = z
  .object({
    title: z.string().trim().min(1, 'El título es obligatorio.'),
    description: optionalText,
    start: z.string().min(1, 'La fecha de inicio es obligatoria.'),
    end: z.string().min(1, 'La fecha de término es obligatoria.'),
    status: z.enum(['scheduled', 'in_progress', 'done', 'cancelled']).default('scheduled'),
    technicianId: optionalText,
    crewId: optionalText,
    assetId: optionalText,
    clientId: optionalText,
    meetingUrl: optionalText,
  })
  .refine((d) => new Date(d.end) >= new Date(d.start), {
    message: 'El término no puede ser anterior al inicio.',
    path: ['end'],
  })
export type AssignmentInput = z.infer<typeof assignmentInputSchema>

