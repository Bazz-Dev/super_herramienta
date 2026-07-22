import type { ReportData } from './types'

// Default content shown when opening the technical-report editor. Based on the
// real INGEGAR sample (IT - 260519-JB-PR-78 - PROVIDENCIA) so the user starts
// from a realistic, editable document instead of a blank form.
export const sampleReport: ReportData = {
  reportId: '260519-JB-PR-78',
  version: '01',
  date: '2026-05-19',
  contact: 'Carolina Mañan',
  client: 'Just Burger',
  branch: 'Providencia',
  address: 'Guardia Vieja 62, Providencia, Región Metropolitana',
  subject: 'Mantención preventiva de sistemas de climatización y refrigeración',
  workOrder: '0320',

  intro: 'Informe técnico de la jornada de mantenimiento ejecutada en terreno.',
  sections: [
    {
      title: 'Alcance del servicio',
      body: 'Se llevó a cabo una jornada programada de mantenimiento preventivo integral y revisión de parámetros operacionales en las unidades de frío técnico y climatización de la sucursal. El servicio incluyó:',
      bullets: [
        'Sistemas de conservación en área de producción (03 mesones refrigerados y 01 salsera).',
        'Unidades de almacenamiento térmico (02 cámaras de frío).',
        'Equipos de refrigeración complementarios (03 refrigeradores pequeños / "Refrip").',
        'Confort térmico y barreras de aire (unidad Split / equipo de cielo y 01 cortina de aire).',
      ],
    },
    {
      title: 'Actividades realizadas',
      body: 'Climatización y refrigeración — local completo.',
      bullets: [
        'Área de conservación y frío industrial: mantenimiento preventivo en las 02 cámaras, los 03 mesones refrigerados y la salsera, con limpieza técnica de condensadores, revisión de líneas de drenaje y verificación de hermeticidad en los sellos magnéticos de las puertas.',
        'Sistemas de refrigeración: intervención de las 03 unidades menores (Refrip), evaluando ciclos de trabajo del compresor y controlando temperaturas de régimen técnico para asegurar la cadena de frío.',
        'Área de climatización y cortinas: limpieza de filtros de aire del equipo Split de cielo y mantención de la cortina de aire, asegurando un caudal correcto.',
        'Validación técnica: todos los equipos fueron testeados en su funcionamiento mecánico y eléctrico, registrando temperaturas estables dentro de los rangos de diseño, presiones normalizadas y sin códigos de error.',
      ],
    },
    {
      title: 'Observaciones adicionales',
      body: '',
      bullets: [
        'Detalle técnico: los condensadores presentaban una acumulación moderada de partículas ambientales propia de la operación continua; la limpieza realizada mitiga el riesgo de fatiga por alta presión en los compresores.',
        'Sugerencia: supervisar que el personal mantenga despejadas las rejillas de ventilación de mesones y refrigeradores, evitando la obstrucción del flujo de aire técnico.',
      ],
    },
    {
      title: 'Conclusión',
      body: 'El servicio preventivo planificado fue completado de manera conforme bajo la Orden de Trabajo N° 0320 (código de reporte de control: 260519-JB-PR-78). Al cierre de la asistencia técnica en terreno, la totalidad del parque de equipos de frío y climatización de la sucursal Providencia quedó en estado 100% operativo y funcional.',
      bullets: [],
    },
  ],

  photos: [],
  otImageUrl: '',

  company: 'INGEGAR CHILE SpA.',
  rut: '77.542.218-1',
  email: 'contacto@ingegarchile.cl',
  phone: '+56 9 7962 7151',
  web: 'www.ingegarchile.cl',
}
