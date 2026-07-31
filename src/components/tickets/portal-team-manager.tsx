'use client'

import { useActionState, useState, useTransition } from 'react'
import { createPortalTeamUser, togglePortalTeamUserActive, type PortalTeamUserFormState } from '@/app/portal/[slug]/sucursales/actions'
import { PortalRevealedCredential } from './portal-revealed-credential'

interface TeamUser {
  id: string
  email: string
  username: string | null
  active: boolean
  isClientAdmin: boolean
  branchId: string | null
}
interface Branch { id: string; name: string }

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: 8, border: '1.5px solid rgba(24,19,14,0.15)',
  padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}

// Equivalente inline-styled de PortalUserManager (INGEGAR One) para el propio
// admin del cliente — crea usuarios de sucursal y otros admins del cliente
// ("admin aprobador"), nunca toca `role` (siempre 'client'), ver
// requireClientAdmin() en ../../app/portal/[slug]/sucursales/actions.ts.
// canManage: false para staff `supervisor` — mismo criterio que isSuper en
// PortalUserManager (INGEGAR One), supervisor gestiona sucursales pero no
// cuentas/credenciales de usuarios de portal (requireActor(['super']) en
// createPortalUser et al.). El gate real vive en el server action; esto
// solo evita mostrar controles que igual rebotarían con "No autorizado".
export function PortalTeamManager({ clientId, users, branches, primary, canManage }: { clientId: string; users: TeamUser[]; branches: Branch[]; primary: string; canManage: boolean }) {
  const [showForm, setShowForm] = useState(false)
  const createAction = createPortalTeamUser.bind(null, clientId)
  const [state, dispatch, pending] = useActionState<PortalTeamUserFormState, FormData>(createAction, {})
  const [revealed, setRevealed] = useState<{ email: string; username: string | null; password: string } | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState('')
  const [isPending, startTransition] = useTransition()

  const [seenSuccess, setSeenSuccess] = useState(state.success)
  if (state.success !== seenSuccess) {
    setSeenSuccess(state.success)
    if (state.success) { setRevealed(state.success); setShowForm(false) }
  }

  function toggle(u: TeamUser) {
    setToggleError('')
    setTogglingId(u.id)
    startTransition(async () => {
      const res = await togglePortalTeamUserActive(clientId, u.id, !u.active)
      if (res.error) setToggleError(res.error)
    })
  }

  const branchName = (id: string | null) => branches.find(b => b.id === id)?.name

  return (
    <div className="pcard" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>Usuarios de tu equipo ({users.length})</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 12, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {showForm ? 'Cancelar' : '+ Agregar usuario'}
          </button>
        )}
      </div>

      {revealed && (
        <div style={{ marginBottom: 12 }}>
          <PortalRevealedCredential {...revealed} onDismiss={() => setRevealed(null)} />
        </div>
      )}

      {canManage && showForm && (
        <form action={dispatch} style={{ marginBottom: 12, borderRadius: 8, border: `1px solid ${primary}33`, background: `${primary}0d`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input name="name" placeholder="Nombre *" required style={inputStyle} />
          <input name="email" type="email" placeholder="Email *" required style={inputStyle} />
          <input name="username" placeholder="Usuario (opcional)" style={inputStyle} />
          {branches.length > 0 && (
            <select name="branchId" defaultValue="" style={inputStyle}>
              <option value="">Sin sucursal (acceso a todo tu cliente)</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(24,19,14,0.6)' }}>
            <input type="checkbox" name="isClientAdmin" style={{ accentColor: primary }} />
            Admin del cliente (aprueba solicitudes de sucursal, puede crear más usuarios)
          </label>
          {state.error && <p style={{ fontSize: 12, color: '#dc2626' }}>{state.error}</p>}
          <button type="submit" disabled={pending} className="pbtn pbtn-primary" style={{ alignSelf: 'flex-start' }}>
            {pending ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      )}

      {users.length === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(24,19,14,0.4)', fontStyle: 'italic' }}>Sin usuarios todavía.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 8, background: 'rgba(24,19,14,0.03)', padding: '8px 10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: u.active ? '#18130e' : 'rgba(24,19,14,0.35)', textDecoration: u.active ? 'none' : 'line-through' }}>{u.email}</span>
                  {u.isClientAdmin && (
                    <span style={{ borderRadius: 20, background: '#ede9fe', padding: '1px 7px', fontSize: 9, fontWeight: 700, color: '#6d28d9' }}>Admin cliente</span>
                  )}
                  {u.branchId && branchName(u.branchId) && (
                    <span style={{ borderRadius: 20, background: 'rgba(24,19,14,0.06)', padding: '1px 7px', fontSize: 9, color: 'rgba(24,19,14,0.5)' }}>{branchName(u.branchId)}</span>
                  )}
                </div>
                {u.username && <span style={{ fontSize: 11, color: 'rgba(24,19,14,0.35)' }}>@{u.username}</span>}
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => toggle(u)}
                  disabled={isPending && togglingId === u.id}
                  style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 36,
                    borderRadius: 20, padding: '0 12px', fontSize: 10, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: u.active ? '#dcfce7' : '#f3f4f6',
                    color: u.active ? '#15803d' : '#6b7280',
                  }}
                >
                  {u.active ? 'Activo' : 'Inactivo'}
                </button>
              ) : (
                <span
                  style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 36,
                    borderRadius: 20, padding: '0 12px', fontSize: 10, fontWeight: 700,
                    background: u.active ? '#dcfce7' : '#f3f4f6',
                    color: u.active ? '#15803d' : '#6b7280',
                  }}
                >
                  {u.active ? 'Activo' : 'Inactivo'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {toggleError && <p style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>{toggleError}</p>}
    </div>
  )
}
