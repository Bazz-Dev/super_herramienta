import { z } from 'zod'

// Data model for a technical report ("Informe Técnico"). A4 paginated.
// Structure mirrors the INGEGAR sample (IT - 260519-JB-PR-78 - PROVIDENCIA):
//   identification block + numbered sections + photo annex ("Registro fotográfico").

// One numbered section: a title, an optional intro paragraph, and an optional
// bullet list. Covers every section in the sample (Alcance, Actividades,
// Observaciones, Conclusión).
export const reportSectionSchema = z.object({
  title: z.string().min(1),
  body: z.string().default(''), // intro paragraph (optional)
  bullets: z.array(z.string().min(1)).default([]), // bullet list (optional)
})

// A photo in the annex. `url` is a data: URI (built client-side) or a path.
export const reportPhotoSchema = z.object({
  url: z.string().min(1),
  caption: z.string().default(''),
})

export const reportDataSchema = z.object({
  // Identification
  reportId: z.string().min(1), // e.g. "260519-JB-PR-78" (código de reporte)
  version: z.string().default('01'),
  date: z.string().min(1),
  contact: z.string().default(''), // INGEGAR responsible (e.g. "Carolina Mañan")
  client: z.string().min(1),
  branch: z.string().default(''), // sucursal (e.g. "Providencia")
  address: z.string().default(''),
  subject: z.string().default(''), // observación / asunto (one line)
  workOrder: z.string().default(''), // N° Orden de Trabajo (optional)

  // Body
  intro: z.string().default(''), // optional opening line under "Informe técnico:"
  sections: z.array(reportSectionSchema).default([]),

  // Photo annex
  photos: z.array(reportPhotoSchema).default([]),

  // Footer / company block
  company: z.string().default('INGEGAR CHILE SpA.'),
  rut: z.string().default('77.542.218-1'),
  email: z.string().default('contacto@ingegarchile.cl'),
  phone: z.string().default('+56 9 7962 7151'),
  web: z.string().default('www.ingegarchile.cl'),
})

export type ReportSection = z.infer<typeof reportSectionSchema>
export type ReportPhoto = z.infer<typeof reportPhotoSchema>
export type ReportData = z.infer<typeof reportDataSchema>

// Filename / title for the generated PDF: "IT - <reportId> - <BRANCH>".
export function reportFilename(data: Pick<ReportData, 'reportId' | 'branch'>): string {
  const branch = data.branch ? ` - ${data.branch.toUpperCase()}` : ''
  return `IT - ${data.reportId}${branch}`
}
