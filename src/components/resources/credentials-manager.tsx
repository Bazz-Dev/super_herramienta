'use client'

import { useActionState, useState, useTransition } from 'react'
import { createSecret, updateSecret, deleteSecret, revealSecret } from '@/app/(app)/recursos/credenciales/actions'
import { Modal } from '@/components/resources/modal'
import { buttonClass } from '@/components/ui/button'

interface Secret {
  id: string
  serviceName: string
  url: string | null
  username: string | null
  notes: string | null
  createdAt: string
  createdByName: string
}

const fieldCls = 'flex-1 rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

export function CredentialsManager({ secrets }: { secrets: Secret[] }) {
  const [showForm, setShowForm] = useState(false)
  const [state, dispatch, pending] = useActionState(createSecret, {})

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Credenciales ({secrets.length})
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          {showForm ? 'Cancelar' : '+ Nueva credencial'}
        </button>
      </div>

      {showForm && (
        <form
          action={(fd) => { dispatch(fd); setShowForm(false) }}
          className="mb-3 space-y-2 rounded-lg border border-brand/20 bg-brand/5 p-3"
        >
          <div className="flex gap-2">
            <input name="serviceName" placeholder="Servicio *" required className={fieldCls} />
            <input name="url" placeholder="URL" className={fieldCls} />
          </div>
          <div className="flex gap-2">
            <input name="username" placeholder="Usuario" className={fieldCls} />
            <input name="secretValue" type="password" placeholder="Secreto (password, token, etc.) *" required className={fieldCls} />
          </div>
          <textarea name="notes" placeholder="Notas" rows={2} className={`${fieldCls} w-full`} />
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar credencial'}
          </button>
        </form>
      )}

      {secrets.length === 0 ? (
        <p className="text-xs italic text-gray-400">Sin credenciales guardadas todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {secrets.map((s) => <SecretRow key={s.id} secret={s} />)}
        </div>
      )}
    </div>
  )
}

function SecretRow({ secret: s }: { secret: Secret }) {
  const [editing, setEditing] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateAction = updateSecret.bind(null, s.id)
  const [state, dispatch, pending] = useActionState(updateAction, {})
  const [, startDeleteTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)

  function doDelete() {
    setDeleting(true)
    startDeleteTransition(async () => {
      await deleteSecret(s.id)
      setDeleting(false)
      setConfirmDelete(false)
    })
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-ink">{s.serviceName}</span>
          {s.username && <span className="ml-2 text-xs text-gray-400">{s.username}</span>}
          {s.url && (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-brand hover:underline">
              {s.url} ↗
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setRevealOpen(true)} className="text-[11px] font-semibold text-brand-700 hover:underline">
            Revelar
          </button>
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-[11px] font-medium text-gray-500 hover:text-ink hover:underline">
            {editing ? 'Cerrar' : 'Editar'}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-[11px] font-medium text-red-500 hover:underline">
            Eliminar
          </button>
        </div>
      </div>
      {s.notes && !editing && <p className="mt-1 text-xs text-gray-500">{s.notes}</p>}
      <p className="mt-1 text-[10px] text-gray-400">Creado por {s.createdByName} · {new Date(s.createdAt).toLocaleDateString('es-CL')}</p>

      {editing && (
        <form action={dispatch} className="mt-2 space-y-2 border-t border-gray-200 pt-2">
          <div className="flex gap-2">
            <input name="serviceName" defaultValue={s.serviceName} placeholder="Servicio *" required className={fieldCls} />
            <input name="url" defaultValue={s.url ?? ''} placeholder="URL" className={fieldCls} />
          </div>
          <div className="flex gap-2">
            <input name="username" defaultValue={s.username ?? ''} placeholder="Usuario" className={fieldCls} />
            <input name="secretValue" type="password" placeholder="Nuevo secreto (dejar vacío para no cambiarlo)" className={fieldCls} />
          </div>
          <textarea name="notes" defaultValue={s.notes ?? ''} placeholder="Notas" rows={2} className={`${fieldCls} w-full`} />
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50">
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:underline">Cerrar</button>
          </div>
        </form>
      )}

      {revealOpen && <RevealModal secretId={s.id} serviceName={s.serviceName} username={s.username} onClose={() => setRevealOpen(false)} />}

      {confirmDelete && (
        <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar credencial">
          <p className="mb-4 text-sm text-gray-600">
            ¿Eliminar la credencial de <strong>{s.serviceName}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass('secondary', 'md')}>Cancelar</button>
            <button type="button" onClick={doDelete} disabled={deleting} className={buttonClass('danger', 'md')}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Reautenticación (password del usuario logueado, no del secreto) antes de
// descifrar — informe #21. El valor descifrado solo vive en este estado de
// componente, nunca se persiste; se limpia al cerrar el modal.
function RevealModal({ secretId, serviceName, username, onClose }: { secretId: string; serviceName: string; username: string | null; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [value, setValue] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError('')
    startTransition(async () => {
      const res = await revealSecret(secretId, password)
      if (res.error) { setError(res.error); return }
      setValue(res.value ?? null)
    })
  }

  async function copy() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open onClose={onClose} title={`Revelar credencial — ${serviceName}`}>
      {!value ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Ingresa tu contraseña para revelar el secreto. Queda registrado quién lo revela y cuándo.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="Tu contraseña"
            autoFocus
            className={`${fieldCls} w-full`}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={buttonClass('secondary', 'md')}>Cancelar</button>
            <button type="button" onClick={submit} disabled={isPending || !password} className={buttonClass('primary', 'md')}>
              {isPending ? 'Verificando…' : 'Revelar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <span aria-hidden>🔑</span> Secreto revelado — se vuelve a ocultar al cerrar
          </p>
          <dl className="mb-2 space-y-1 text-sm">
            {username && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-gray-500">Usuario</dt>
                <dd className="font-medium text-ink">{username}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-gray-500">Secreto</dt>
              <dd className="break-all font-mono font-semibold text-ink">{value}</dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700">
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100">
              Ocultar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
