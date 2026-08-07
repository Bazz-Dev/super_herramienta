import { prisma } from '@/lib/prisma'
import { notify, type NotificationPayload } from '@/lib/push'
import { defaultEnabledFor } from './events'

// Servicio central de publicación (FASE 6 del brief: "un servicio central de
// publicación de notificaciones", evitar condicionales dispersos). Envuelve
// notify() (ya hace in-app + push) con el chequeo de preferencia -- el canal
// "en aplicación" y el push existente se gatillan juntos por evento; no hay
// canal de correo porque el sistema no tiene envío de correo estable hoy
// (brief: solo agregarlo "si el sistema ya tiene envío de correo estable").
export async function isNotificationEnabled(userId: string, eventKey: string): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({ where: { userId }, select: { allEnabled: true, overrides: true } })
  if (!pref) return defaultEnabledFor(eventKey)
  if (!pref.allEnabled) return false
  let overrides: Record<string, boolean> = {}
  try { overrides = JSON.parse(pref.overrides) } catch { /* ignore, usa default */ }
  return overrides[eventKey] ?? defaultEnabledFor(eventKey)
}

export async function publishNotification(
  userId: string, tenantId: string, eventKey: string, payload: NotificationPayload,
): Promise<void> {
  if (!(await isNotificationEnabled(userId, eventKey))) return
  await notify(userId, tenantId, { ...payload, type: eventKey })
}

/** Fan-out a varios usuarios (ej. todo el staff del tenant), cada uno con su propia preferencia. */
export async function publishNotificationToMany(
  userIds: string[], tenantId: string, eventKey: string, payload: NotificationPayload,
): Promise<void> {
  await Promise.all(userIds.map(id => publishNotification(id, tenantId, eventKey, payload)))
}

/** Mismo patrón que notifyTenantStaff (push.ts) pero gateado por preferencia individual de cada staff. */
export async function publishToTenantStaff(
  tenantId: string, eventKey: string, payload: NotificationPayload,
): Promise<void> {
  const staff = await prisma.user.findMany({
    where: { tenantId, role: { in: ['super', 'supervisor'] }, active: true },
    select: { id: true },
  })
  await publishNotificationToMany(staff.map(u => u.id), tenantId, eventKey, payload)
}
