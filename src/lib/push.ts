import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

// PUSH_DISABLED=1 (E2E/local): no se envía ningún push real; la Notification en DB
// sí se persiste (notify) — la operación principal nunca depende del push.
const PUSH_DISABLED = process.env.PUSH_DISABLED === '1'

if (!PUSH_DISABLED && process.env.NEXT_PUBLIC_VAPID_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? 'mailto:admin@ingegarchile.cl',
    process.env.NEXT_PUBLIC_VAPID_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export interface NotificationPayload {
  title: string
  body: string
  href?: string
  icon?: string
}

/** Send a push notification to all subscriptions of a user. */
export async function sendPushToUser(userId: string, payload: NotificationPayload) {
  if (PUSH_DISABLED) return
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  const json = JSON.stringify({ ...payload, icon: payload.icon ?? '/icons/icon-192.png' })
  const dead: string[] = []

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, json)
      } catch (e: unknown) {
        // 410 Gone = subscription expired, clean up
        if (e instanceof Error && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
          dead.push(s.id)
        }
      }
    }),
  )

  if (dead.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } })
}

/** Send a push to all staff (super + supervisor) of a tenant. */
export async function sendPushToTenantStaff(tenantId: string, payload: NotificationPayload) {
  const staff = await prisma.user.findMany({
    where: { tenantId, role: { in: ['super', 'supervisor'] }, active: true },
    select: { id: true },
  })
  await Promise.all(staff.map((u) => sendPushToUser(u.id, payload)))
}

/** Persist a notification record + send push. */
export async function notify(
  userId: string,
  tenantId: string,
  payload: NotificationPayload & { type: string },
) {
  await prisma.notification.create({
    data: { userId, tenantId, type: payload.type, title: payload.title, body: payload.body, href: payload.href },
  })
  await sendPushToUser(userId, payload)
}

export async function notifyTenantStaff(
  tenantId: string,
  payload: NotificationPayload & { type: string },
) {
  const staff = await prisma.user.findMany({
    where: { tenantId, role: { in: ['super', 'supervisor'] }, active: true },
    select: { id: true },
  })
  await Promise.all(staff.map((u) => notify(u.id, tenantId, payload)))
}
