import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { cookies } from 'next/headers'

const COOKIE = 'viewas'
const OPTS = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400 } as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'super') return new NextResponse('Forbidden', { status: 403 })
  const { userId } = (await req.json()) as { userId?: string }
  if (!userId) return new NextResponse('Missing userId', { status: 400 })
  const store = await cookies()
  store.set(COOKIE, userId, OPTS)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  if (session?.user?.role !== 'super') return new NextResponse('Forbidden', { status: 403 })
  const store = await cookies()
  store.delete(COOKIE)
  return NextResponse.json({ ok: true })
}
