'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signDocument, rejectDocument } from './actions'
import { Spinner } from '@/components/ui/spinner'

interface SignReq {
  id: string
  documentType: string
  documentTitle: string
  documentData: string
  documentHash: string
  status: string
  rutConfirmed: string | null
  signedAt: string | null
  createdAt: string
}

const STATUS_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border border-amber-200',
  firmado:   'bg-green-50 text-green-700 border border-green-200',
  rechazado: 'bg-red-50 text-red-700 border border-red-200',
}
const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  firmado:   'Firmado',
  rechazado: 'Rechazado',
}

function DocumentModal({ req, onClose }: { req: SignReq; onClose: () => void }) {
  const [rut, setRut] = useState('')
  const [step, setStep] = useState<'view' | 'confirm' | 'done' | 'reject'>('view')
  const [rejectNote, setRejectNote] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function doSign() {
    if (!rut.trim()) { setError('Ingresa tu RUT para confirmar'); return }
    setError('')
    startTransition(async () => {
      const res = await signDocument(req.id, rut.trim())
      if (res.success) { setStep('done') ; router.refresh() }
      else setError(res.error ?? 'Error al firmar')
    })
  }

  function doReject() {
    startTransition(async () => {
      const res = await rejectDocument(req.id, rejectNote)
      if (res.success) { onClose(); router.refresh() }
      else setError(res.error ?? 'Error')
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>{req.documentType}</p>
          <h3 style={{ fontSize: '17px', fontWeight: '700' }}>{req.documentTitle}</h3>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', fontFamily: 'monospace' }}>Hash: {req.documentHash.slice(0, 16)}…</p>
        </div>

        {step === 'done' ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#15803d' }}>Documento firmado</p>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>Tu firma ha sido registrada con timestamp e IP.</p>
            <button onClick={onClose} style={{ marginTop: '20px', padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#f5b100', color: '#111', fontWeight: '600', cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        ) : step === 'reject' ? (
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: '14px', marginBottom: '14px' }}>¿Por qué rechazas este documento? (opcional)</p>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Motivo del rechazo…" />
            {error && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setStep('view')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}>Volver</button>
              <button onClick={doReject} disabled={isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px', opacity: isPending ? 0.7 : 1 }}>
                {isPending && <Spinner size={13} />}
                {isPending ? 'Rechazando…' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Document content */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', maxHeight: '300px', overflow: 'auto' }}>
              <pre style={{ fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6' }}>
                {req.documentData}
              </pre>
            </div>

            {step === 'view' && (
              <div style={{ padding: '16px 24px', display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
                <button onClick={() => setStep('reject')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #fca5a5', color: '#dc2626', background: '#fef2f2', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
                  Rechazar
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'transparent', fontSize: '13px', cursor: 'pointer', color: '#374151' }}>
                    Cancelar
                  </button>
                  <button onClick={() => setStep('confirm')} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#f5b100', color: '#111', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                    Firmar ✍️
                  </button>
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <div style={{ padding: '20px 24px' }}>
                <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '6px' }}>Confirma tu identidad</p>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>Ingresa tu RUT para confirmar que leíste y aceptas este documento.</p>
                <input
                  value={rut}
                  onChange={e => setRut(e.target.value)}
                  placeholder="Ej: 12.345.678-9"
                  style={inputStyle}
                  autoFocus
                />
                {error && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>{error}</p>}
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '10px', lineHeight: '1.5' }}>
                  Al confirmar, quedará registrado: tu sesión autenticada, RUT ingresado, hash del documento, timestamp ({new Date().toLocaleString('es-CL')}) e IP de conexión.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button onClick={() => setStep('view')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}>
                    Volver
                  </button>
                  <button onClick={doSign} disabled={isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#15803d', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
                    {isPending && <Spinner size={13} />}
                    {isPending ? 'Firmando…' : 'Confirmar firma'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function SignaturePendingList({ pending, signed }: { pending: SignReq[]; signed: SignReq[] }) {
  const [selected, setSelected] = useState<SignReq | null>(null)

  if (pending.length === 0 && signed.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
        <p className="text-sm text-gray-400">Sin documentos pendientes de firma.</p>
      </div>
    )
  }

  return (
    <>
      {selected && <DocumentModal req={selected} onClose={() => setSelected(null)} />}

      {pending.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {pending.map(r => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-800 truncate">{r.documentTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.documentType} · {new Date(r.createdAt).toLocaleDateString('es-CL')}</p>
              </div>
              <button
                onClick={() => setSelected(r)}
                className="flex-shrink-0 rounded-lg border border-amber-400 bg-amber-400 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-500 transition-colors"
              >
                Ver y firmar
              </button>
            </div>
          ))}
        </div>
      )}

      {signed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Historial</p>
          <div className="flex flex-col gap-1.5">
            {signed.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{r.documentTitle}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.status === 'firmado' && r.signedAt ? `Firmado el ${new Date(r.signedAt).toLocaleDateString('es-CL')}` : `${STATUS_LABEL[r.status]} · ${new Date(r.createdAt).toLocaleDateString('es-CL')}`}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[r.status] ?? ''}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
