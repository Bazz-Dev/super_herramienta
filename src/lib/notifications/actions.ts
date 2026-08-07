'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NOTIFICATION_EVENTS, defaultEnabledFor, type NotificationAudience } from './events'

export type NotificationPrefsView = {
  allEnabled: boolean
  events: { key: string; label: string; description: string; enabled: boolean }[]
}

// Un solo action compartido entre el portal (rol client) y la app interna
// (rol super/supervisor) -- ambos operan siempre sobre SU PROPIA sesión,
// nunca sobre un userId recibido del cliente, así que no hay superficie de
// escalada entre roles acá.
export async function getMyNotificationPreferences(): Promise<NotificationPrefsView | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const audience: NotificationAudience = session.user.role === 'client' ? 'client' : 'admin'

  const pref = await prisma.notificationPreference.findUnique({ where: { userId: session.user.id } })
  let overrides: Record<string, boolean> = {}
  if (pref?.overrides) {
    try { overrides = JSON.parse(pref.overrides) } catch { /* ignore */ }
  }

  return {
    allEnabled: pref?.allEnabled ?? true,
    events: NOTIFICATION_EVENTS.filter(e => e.audience === audience).map(e => ({
      key: e.key, label: e.label, description: e.description,
      enabled: overrides[e.key] ?? defaultEnabledFor(e.key),
    })),
  }
}

export async function updateMyNotificationPreferences(input: { allEnabled: boolean; overrides: Record<string, boolean> }): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'No autorizado.' }

  await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, allEnabled: input.allEnabled, overrides: JSON.stringify(input.overrides) },
    update: { allEnabled: input.allEnabled, overrides: JSON.stringify(input.overrides) },
  })
  return {}
}
