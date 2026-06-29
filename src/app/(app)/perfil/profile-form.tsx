'use client'

import { useActionState, useState } from 'react'
import { updateProfile, changePassword } from './actions'

const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'
const labelCls = 'flex flex-col gap-1 text-sm'

export function ProfileForm({ name, username, email }: { name: string; username: string; email: string }) {
  type ActionState = { error?: string; success?: boolean }
  const [profileState, profileAction, profilePending] = useActionState<ActionState, FormData>(updateProfile, {})
  const [pwState, pwAction, pwPending] = useActionState<ActionState, FormData>(changePassword, {})
  const [showPw, setShowPw] = useState(false)

  return (
    <div className="space-y-4">
      {/* ── Edit name & username ─────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-ink">Datos de perfil</h2>
        <form action={profileAction} className="space-y-3">
          <label className={labelCls}>
            <span className="font-medium">Nombre</span>
            <input name="name" defaultValue={name} required className={inputCls} />
          </label>
          <label className={labelCls}>
            <span className="font-medium">Usuario (nickname)</span>
            <input
              name="username"
              defaultValue={username}
              placeholder="ej. sgarrido"
              className={inputCls}
            />
            <span className="text-xs text-gray-400">Solo letras, números, guiones y puntos. Usado para el login rápido.</span>
          </label>
          <label className={labelCls}>
            <span className="font-medium text-gray-400">Email (no editable)</span>
            <input value={email} disabled className={`${inputCls} cursor-not-allowed bg-gray-50 text-gray-400`} />
          </label>

          {profileState.error && <p className="text-sm text-red-600">{profileState.error}</p>}
          {profileState.success && <p className="text-sm text-green-600">Perfil actualizado ✓</p>}

          <button
            type="submit"
            disabled={profilePending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-600 disabled:opacity-60"
          >
            {profilePending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </section>

      {/* ── Change password ──────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-ink">Cambiar contraseña</h2>
        <form action={pwAction} className="space-y-3">
          <label className={labelCls}>
            <span className="font-medium">Contraseña actual</span>
            <input name="currentPassword" type={showPw ? 'text' : 'password'} required className={inputCls} />
          </label>
          <label className={labelCls}>
            <span className="font-medium">Nueva contraseña</span>
            <input name="newPassword" type={showPw ? 'text' : 'password'} required minLength={8} className={inputCls} />
          </label>
          <label className={labelCls}>
            <span className="font-medium">Confirmar nueva contraseña</span>
            <input name="confirmPassword" type={showPw ? 'text' : 'password'} required className={inputCls} />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="accent-brand" />
            Mostrar contraseñas
          </label>

          {pwState.error && <p className="text-sm text-red-600">{pwState.error}</p>}
          {pwState.success && <p className="text-sm text-green-600">Contraseña actualizada ✓</p>}

          <button
            type="submit"
            disabled={pwPending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-600 disabled:opacity-60"
          >
            {pwPending ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </section>
    </div>
  )
}
