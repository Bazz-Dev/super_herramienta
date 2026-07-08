'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/auth'
import { prisma } from '@/lib/prisma'

export type LoginState = { error?: string }

export async function authenticate(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const login = (formData.get('login') as string) ?? ''
  const password = formData.get('password') as string

  // Pre-fetch role to choose the correct landing page.
  // Credentials are still verified by authorize() in auth.ts — this only determines where to send the user.
  const isEmail = login.includes('@')
  const userRecord = await prisma.user.findFirst({
    where: isEmail ? { email: login } : { username: login },
    select: { role: true },
  })
  const redirectTo = userRecord?.role === 'tecnico' ? '/mi-panel' : '/dashboard'

  try {
    await signIn('credentials', { login, password, redirectTo })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Usuario o contraseña incorrectos.' }
    }
    // Re-throw redirect signals (NEXT_REDIRECT) and anything unexpected.
    throw error
  }
}
