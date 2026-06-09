import type { QuoteData } from './types'

// Example data for previewing the template. Content is illustrative — replace
// with real form input. Avoids generic AI/commercial filler per DESIGN-SYSTEM.MD.
export const sampleQuote: QuoteData = {
  quoteId: 'ING-MANT-260609-ALCON-001',
  date: '2026-06-09',
  validityDays: 30,
  client: {
    name: 'Alcon Laboratorios Chile',
    contact: 'Depto. Operaciones',
    rut: '96.789.000-1',
  },
  tagline: 'Ingeniería y Gestión de Activos',
  chips: [],
  executiveSummary:
    'Servicio de mantención preventiva semestral para los equipos de climatización de las salas limpias, incluyendo cambio de filtros HEPA, medición de caudales y certificación de partículas según protocolo interno.',
  scope: [
    {
      title: 'Mantención de unidades manejadoras de aire (UMA)',
      detail: 'Limpieza de serpentines, cambio de correas y verificación de variadores en 4 UMA.',
    },
    {
      title: 'Cambio de filtros HEPA',
      detail: 'Reemplazo de 18 filtros H14 con registro fotográfico y test de integridad DOP.',
    },
    {
      title: 'Certificación de partículas',
      detail: 'Conteo de partículas en reposo y operación; emisión de informe ISO 14644-1.',
    },
  ],
  items: [
    { description: 'Mantención UMA (por unidad)', quantity: 4, unitPrice: 320000 },
    { description: 'Filtro HEPA H14 + instalación', detail: 'Incluye test DOP', quantity: 18, unitPrice: 145000 },
    { description: 'Certificación de partículas ISO 14644-1', quantity: 1, unitPrice: 680000 },
  ],
  currency: 'CLP',
  taxRate: 0.19,
  exclusions: [
    'Repuestos no especificados en el itemizado.',
    'Trabajos en horario nocturno o festivos (se cotizan aparte).',
    'Obras civiles o modificaciones de ductería.',
  ],
  commercialConditions: [
    'Forma de pago: 50% contra orden de compra, 50% contra entrega de informe.',
    'Plazo de ejecución: 10 días hábiles desde la recepción de la OC.',
    'Garantía de 6 meses sobre la mano de obra.',
  ],
  contact: {
    company: 'INGEGAR SpA',
    email: 'contacto@ingegarchile.cl',
    phone: '+56 9 1234 5678',
    web: 'ingegarchile.cl',
  },
}
