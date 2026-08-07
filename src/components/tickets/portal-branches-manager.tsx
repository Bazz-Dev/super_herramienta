'use client'

import { useActionState, useState, useTransition } from 'react'
import { createPortalBranch, togglePortalBranchActive, deletePortalBranch, type PortalBranchFormState } from '@/app/portal/[slug]/sucursales/actions'

interface Branch {
  id: string
  name: string
  city: string | null
  active: boolean
  userCount: number
  hasHistory: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: 8, border: '1.5px solid rgba(24,19,14,0.15)',
  padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}

// Mismo espíritu que BranchManager (src/components/resources/branch-manager.tsx,
// lado INGEGAR One) pero inline-styled — regla dura del portal, ver
// .claude/rules/frontend.md. El toggle activa/desactiva es de un clic, sin
// confirmación — mismo criterio que toggleBranch interno (reversible, no es
// una acción destructiva real).
export function PortalBranchesManager({ clientId, branches, primary }: { clientId: string; branches: Branch[]; primary: string }) {
  const [showForm, setShowForm] = useState(false)
  const createAction = createPortalBranch.bind(null, clientId)
  const [state, dispatch, pending] = useActionState<PortalBranchFormState, FormData>(createAction, {})
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function toggle(id: string, active: boolean) {
    setTogglingId(id)
    startTransition(() => { togglePortalBranchActive(clientId, id, active) })
  }

  function doDelete(id: string) {
    setDeletingId(id)
    setDeleteError(null)
    startTransition(async () => {
      const res = await deletePortalBranch(clientId, id)
      setConfirmDeleteId(null)
      setDeletingId(null)
      if (res.error) setDeleteError(res.error)
    })
  }

  return (
    <div className="pcard" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>Sucursales ({branches.length})</h2>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 12, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {showForm ? 'Cancelar' : '+ Agregar sucursal'}
        </button>
      </div>

      {showForm && (
        <form action={dispatch} style={{ marginBottom: 12, borderRadius: 8, border: `1px solid ${primary}33`, background: `${primary}0d`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input name="name" placeholder="Nombre sucursal *" required style={inputStyle} />
          <input name="city" placeholder="Ciudad" style={inputStyle} />
          <input name="address" placeholder="Dirección" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input name="contactName" placeholder="Responsable / contacto" style={inputStyle} />
            <input name="contactPhone" placeholder="Teléfono" style={{ ...inputStyle, maxWidth: 140 }} />
          </div>
          {state?.error && <p style={{ fontSize: 12, color: '#dc2626' }}>{state.error}</p>}
          <button type="submit" disabled={pending} className="pbtn pbtn-primary" style={{ alignSelf: 'flex-start' }}>
            {pending ? 'Guardando…' : 'Crear sucursal'}
          </button>
        </form>
      )}

      {branches.length === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(24,19,14,0.4)', fontStyle: 'italic' }}>Sin sucursales todavía.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {branches.map(b => {
            // FASE 5: Activa / Inactiva con historial (gris, sin Eliminar,
            // puede reactivarse) / Inactiva sin historial (puede eliminarse
            // definitivamente, con confirmación). El servidor vuelve a
            // validar esto igual (deletePortalBranch) -- esto es solo UI.
            const canDelete = !b.active && !b.hasHistory
            return (
              <div key={b.id} style={{ borderRadius: 8, background: 'rgba(24,19,14,0.03)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: b.active ? '#18130e' : 'rgba(24,19,14,0.35)', textDecoration: b.active ? 'none' : 'line-through' }}>{b.name}</span>
                    {b.city && <span style={{ marginLeft: 6, fontSize: 11, color: 'rgba(24,19,14,0.4)' }}>{b.city}</span>}
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(24,19,14,0.4)' }}>{b.userCount} usuario{b.userCount === 1 ? '' : 's'}</span>
                    {!b.active && b.hasHistory && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#6b7280' }}>Inactiva — solo histórico</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {canDelete && confirmDeleteId !== b.id && (
                      <button
                        type="button"
                        onClick={() => { setConfirmDeleteId(b.id); setDeleteError(null) }}
                        style={{ minHeight: 36, padding: '0 10px', fontSize: 10, fontWeight: 700, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Eliminar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(b.id, !b.active)}
                      disabled={isPending && togglingId === b.id}
                      style={{
                        flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 36,
                        borderRadius: 20, padding: '0 12px', fontSize: 10, fontWeight: 700,
                        border: 'none', cursor: 'pointer',
                        background: b.active ? '#dcfce7' : '#f3f4f6',
                        color: b.active ? '#15803d' : '#6b7280',
                      }}
                    >
                      {b.active ? 'Activa' : 'Inactiva'}
                    </button>
                  </div>
                </div>
                {confirmDeleteId === b.id && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', padding: '8px 10px' }}>
                    <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600, flex: 1 }}>¿Eliminar &quot;{b.name}&quot; definitivamente? No se puede deshacer.</span>
                    <button type="button" onClick={() => setConfirmDeleteId(null)} style={{ minHeight: 32, padding: '0 10px', fontSize: 11, fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>No</button>
                    <button type="button" onClick={() => doDelete(b.id)} disabled={deletingId === b.id} style={{ minHeight: 32, padding: '0 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', cursor: 'pointer' }}>
                      {deletingId === b.id ? 'Eliminando…' : 'Sí, eliminar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {deleteError && <p style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>{deleteError}</p>}
    </div>
  )
}
