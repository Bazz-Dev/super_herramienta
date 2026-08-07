// Matriz central de eventos de notificación (FASE 6 del brief) -- una sola
// fuente de verdad para qué eventos existen, a quién le corresponden
// (cliente del portal vs. staff INGEGAR) y su valor por defecto, en vez de
// condicionales sueltos repartidos por cada action que notifica. Reusable
// tanto para el matching real (isNotificationEnabled) como para dibujar la
// pantalla de preferencias en ambos "Mi cuenta"/"Configuración".
//
// No todos los eventos que el brief nombra tienen hoy un disparador real en
// el código -- varios puntos muy finos del brief (ej. "técnico asignado" vs.
// "reasignado", o cada tipo de documento subido por separado) se agrupan acá
// en una sola clave cuando el trigger real del código ya los trata igual
// (ver docs/superpowers/plans/2026-08-06-portal-upgrade-progress.md para el
// detalle de qué evento mapea a qué call site real).
export type NotificationAudience = 'client' | 'admin'

export interface NotificationEventDef {
  key: string
  audience: NotificationAudience
  label: string
  description: string
  defaultEnabled: boolean
}

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  // ── Cliente (portal) ──
  { key: 'client_ticket_status_changed', audience: 'client', label: 'Cambio de estado', description: 'Cuando tu solicitud cambia de estado.', defaultEnabled: true },
  { key: 'client_ticket_assigned', audience: 'client', label: 'Técnico asignado', description: 'Cuando se asigna o reasigna un técnico a tu solicitud.', defaultEnabled: true },
  { key: 'client_ticket_comment', audience: 'client', label: 'Nuevo comentario', description: 'Cuando INGEGAR responde en tu solicitud.', defaultEnabled: true },
  { key: 'client_document_uploaded', audience: 'client', label: 'Documentación subida', description: 'Fotos, OT, informe técnico, propuesta u otro documento nuevo.', defaultEnabled: true },
  { key: 'client_proposal_available', audience: 'client', label: 'Propuesta disponible', description: 'Cuando hay una propuesta nueva para revisar.', defaultEnabled: true },
  { key: 'client_ticket_finished', audience: 'client', label: 'Ticket finalizado', description: 'Cuando tu solicitud se marca como resuelta.', defaultEnabled: true },
  { key: 'client_ticket_reopened', audience: 'client', label: 'Ticket reabierto', description: 'Cuando una solicitud cerrada se reabre.', defaultEnabled: true },
  { key: 'client_ticket_cancelled', audience: 'client', label: 'Ticket cancelado o no aprobado', description: 'Cuando tu solicitud se cancela o el admin de tu empresa no la aprueba.', defaultEnabled: true },
  { key: 'client_branch_request_pending', audience: 'client', label: 'Solicitud de sucursal pendiente', description: 'Cuando una sucursal crea una solicitud que necesitas aprobar (solo admin del cliente).', defaultEnabled: true },
  { key: 'client_document_error', audience: 'client', label: 'Error de documento', description: 'Cuando un documento falla al generarse o vuelve a estar disponible.', defaultEnabled: false },

  // ── Admin (INGEGAR) ──
  { key: 'admin_ticket_new', audience: 'admin', label: 'Cliente crea o aprueba un ticket', description: 'Nueva solicitud lista para asignar.', defaultEnabled: true },
  { key: 'admin_ticket_comment', audience: 'admin', label: 'Cliente agrega comentario o documento', description: '', defaultEnabled: true },
  { key: 'admin_ticket_merge', audience: 'admin', label: 'Cliente fusiona o desfusiona tickets', description: '', defaultEnabled: false },
  { key: 'admin_ticket_finished', audience: 'admin', label: 'Ticket finalizado o reabierto', description: '', defaultEnabled: false },
  { key: 'admin_document_error', audience: 'admin', label: 'Error de generación de documento', description: '', defaultEnabled: true },
]

export function eventsFor(audience: NotificationAudience): NotificationEventDef[] {
  return NOTIFICATION_EVENTS.filter(e => e.audience === audience)
}

export function defaultEnabledFor(key: string): boolean {
  return NOTIFICATION_EVENTS.find(e => e.key === key)?.defaultEnabled ?? true
}
