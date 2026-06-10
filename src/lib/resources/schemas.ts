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
})

export type TechnicianInput = z.infer<typeof technicianInputSchema>
