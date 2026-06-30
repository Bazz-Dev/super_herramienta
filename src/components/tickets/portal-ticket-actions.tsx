'use client'

import { useState } from 'react'
import { PortalEditForm } from './portal-edit-form'
import { PortalAddItemForm } from './portal-add-item-form'

interface Props {
  ticketId: string
  canEdit: boolean      // status === 'nuevo'
  canAddItems: boolean  // status === 'nuevo' | 'en_revision'
  initialTitle: string
  initialDescription: string
  initialUrgency: string
  primary: string
}

export function PortalTicketActions({ ticketId, canEdit, canAddItems, initialTitle, initialDescription, initialUrgency, primary }: Props) {
  const [mode, setMode] = useState<'none' | 'edit' | 'add-item'>('none')

  if (!canEdit && !canAddItems) return null

  const btnStyle: React.CSSProperties = {
    padding: '7px 14px', borderRadius: '8px', border: `1px solid ${primary}`,
    background: 'transparent', color: primary, fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
  }

  const panelStyle: React.CSSProperties = {
    background: 'var(--p-card)', border: '1px solid var(--p-bd)', borderRadius: '12px',
    padding: '18px 20px', marginTop: '12px',
  }

  return (
    <div>
      {/* Action buttons */}
      {mode === 'none' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canEdit && (
            <button onClick={() => setMode('edit')} style={btnStyle}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z"/>
              </svg>
              Editar requerimiento
            </button>
          )}
          {canAddItems && (
            <button onClick={() => setMode('add-item')} style={btnStyle}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 2v8M2 6h8"/>
              </svg>
              Agregar sub-tarea
            </button>
          )}
        </div>
      )}

      {/* Edit form */}
      {mode === 'edit' && (
        <div style={panelStyle}>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '14px' }}>
            Editar requerimiento
          </p>
          <PortalEditForm
            ticketId={ticketId}
            initialTitle={initialTitle}
            initialDescription={initialDescription}
            initialUrgency={initialUrgency}
            primary={primary}
            onClose={() => setMode('none')}
          />
        </div>
      )}

      {/* Add item form */}
      {mode === 'add-item' && (
        <div style={panelStyle}>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '14px' }}>
            Nueva sub-tarea
          </p>
          <PortalAddItemForm
            ticketId={ticketId}
            primary={primary}
            onClose={() => setMode('none')}
          />
        </div>
      )}
    </div>
  )
}
