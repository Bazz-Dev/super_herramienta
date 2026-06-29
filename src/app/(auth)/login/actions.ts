'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/auth'

export type LoginState = { error?: string }

export async function authenticate(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn('credentials', {
      login: formData.get('login'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Usuario o contraseña incorrectos.' }
    }
    // Re-throw redirect signals (NEXT_REDIRECT) and anything unexpected.
    throw error
  }
}
