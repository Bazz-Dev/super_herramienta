'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ClientOption {
  id: string
  name: string
}

interface Props {
  clients: ClientOption[]
  dataJson: () => unknown           // the full editor data to persist
  defaultTitle: string
  documentType: 'propuesta' | 'informe'
  // When editing an existing doc, pass its id to PATCH instead of POST
  existingDocId?: string
}

export function SaveDocumentButton({ clients, dataJson, defaultTitle, documentType, existingDocId }: Props) {
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState(defaultTitle)
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function openModal() {
    setTitle(defaultTitle)
    setStatus('idle')
    setErrorMsg('')
    setOpen(true)
  }

  async function save() {
    if (!existingDocId && !clientId) { setErrorMsg('Selecciona un cliente'); return }
    if (!title.trim()) { setErrorMsg('El título es obligatorio'); return }
    setStatus('saving')
    setErrorMsg('')

    try {
      const data = dataJson()
      let res: Response

      if (existingDocId) {
        // Update existing document
        res = await fetch('/api/client-documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existingDocId, title: title.trim(), dataJson: data }),
        })
      } else {
        // Create new document
        res = await fetch('/api/client-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, type: documentType, title: title.trim(), dataJson: data }),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Error al guardar')
      }

      const json = await res.json()
      setStatus('ok')
      router.refresh()

      // If new doc was created, redirect to the editor with docId so next save = update
      if (!existingDocId && json.id) {
        setTimeout(() => {
          const path = documentType === 'propuesta' ? '/cotizador' : '/informe'
          router.replace(`${path}?docId=${json.id}`)
        }, 800)
      } else {
        setTimeout(() => { setOpen(false); setStatus('idle') }, 1600)
      }
    } catch (e) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  const isUpdate = !!existingDocId
  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: '7px', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer', border: 'none',
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        title={`Guardar ${documentType === 'propuesta' ? 'propuesta' : 'informe'} en carpeta del cliente`}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2.5h4l1.5 1.5H11a.5.5 0 01.5.5v5.5a.5.5 0 01-.5.5H2a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5z"/>
        </svg>
        {isUpdate ? 'Guardar cambios' : 'Guardar en cliente'}
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>
              {isUpdate ? 'Guardar cambios' : `Guardar ${documentType === 'propuesta' ? 'propuesta' : 'informe'}`}
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '18px' }}>
              {isUpdate ? 'El documento guardado se actualizará. Puedes descargarlo como PDF desde la carpeta del cliente.' : 'El documento se guardará en la carpeta del cliente. Podrás editarlo o descargarlo como PDF en cualquier momento.'}
            </p>

            {status === 'ok' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>✅</div>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#15803d' }}>
                  {isUpdate ? 'Cambios guardados' : 'Guardado correctamente'}
                </p>
              </div>
            ) : (
              <>
                {!isUpdate && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                      Cliente *
                    </label>
                    <select
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                    >
                      <option value="">Seleccionar cliente…</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                    Título del documento *
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>

                {errorMsg && <p style={{ fontSize: '13px', color: '#dc2626', marginBottom: '12px' }}>{errorMsg}</p>}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setOpen(false)} style={{ ...btnBase, background: '#f3f4f6', color: '#374151' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={() => startTransition(save)}
                    disabled={isPending || status === 'saving'}
                    style={{ ...btnBase, background: '#f5b100', color: '#111', opacity: (isPending || status === 'saving') ? 0.7 : 1 }}
                  >
                    {status === 'saving' ? 'Guardando…' : isUpdate ? 'Guardar cambios' : 'Guardar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
