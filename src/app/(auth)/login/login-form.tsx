'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { authenticate, type LoginState } from './actions'

const initialState: LoginState = {}
const REMEMBER_KEY = 'ingegar.login.email'

const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30'

// Read the remembered email once, lazily (SSR-safe). We never store the password.
function rememberedEmail(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(REMEMBER_KEY) ?? ''
}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(authenticate, initialState)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState(rememberedEmail)
  const [remember, setRemember] = useState(() => rememberedEmail() !== '')

  function onSubmit() {
    if (remember && email) localStorage.setItem(REMEMBER_KEY, email)
    else localStorage.removeItem(REMEMBER_KEY)
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@ingegarchile.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor="password" className="font-medium">Contraseña</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className={`${inputCls} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-gray-400 transition-colors hover:text-gray-700"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-brand"
        />
        Recordar mi correo en este dispositivo
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 cursor-pointer rounded-md bg-brand px-4 py-2 font-semibold text-ink transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.16 3.19M6.7 6.7A18 18 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 5.3-1.7" />
      <path d="m1 1 22 22" />
    </svg>
  )
}
