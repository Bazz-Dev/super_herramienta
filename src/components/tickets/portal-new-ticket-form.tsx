'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortalTicket } from '@/app/portal/[slug]/tickets/actions'

const ACCEPT = 'image/*,video/mp4,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx'
const MAX_FILE_MB = 50

type UploadedFile = { key: string; name: string; mimeType: string }

async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const results: UploadedFile[] = []
  for (const file of files) {
    const res = await fetch('/api/portal-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, mimeType: file.type || 'application/octet-stream' }),
    })
    if (!res.ok) throw new Error(`Error al preparar subida de ${file.name}`)
    const { url, key } = await res.json()
    const putRes = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    if (!putRes.ok) throw new Error(`Error al subir ${file.name}`)
    results.push({ key, name: file.name, mimeType: file.type })
  }
  return results
}

interface Props {
  slug: string
  clientId: string
  clientName: string
  createdById: string
  branches: { id: string; name: string; city: string | null }[]
  defaultBranchId?: string | null
  primary: string
  bg: string
  textColor: string
  isStaff?: boolean
}

const URGENCIES = [
  { value: 'emergencia',  label: 'Emergencia',  desc: 'Servicio afectado, requiere atención inmediata' },
  { value: 'urgencia',    label: 'Urgente',      desc: 'Debe resolverse dentro de 24 horas' },
  { value: 'no_urgente',  label: 'Normal',       desc: 'Sin impacto crítico en operación' },
  { value: 'preventivo',  label: 'Preventivo',   desc: 'Mantención programada o chequeo rutinario' },
]

const CATEGORIES = [
  'Climatización', 'Campana extractora', 'Electricidad', 'Plomería / agua',
  'Refrigeración', 'Gas', 'Estructural / obra civil', 'Equipamiento de cocina',
  'Seguridad / CCTV', 'Iluminación', 'Otro',
]

const T2 = 'rgba(24,19,14,0.55)'
const T3 = 'rgba(24,19,14,0.40)'
const BORDER = 'rgba(24,19,14,0.15)'

export function PortalNewTicketForm({ slug, clientId, clientName, createdById, branches, defaultBranchId, primary, bg, textColor, isStaff }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [urgency, setUrgency] = useState('no_urgente')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const lockedBranch = defaultBranchId ? branches.find(b => b.id === defaultBranchId) : null

  const inp: React.CSSProperties = {
    width: '100%', borderRadius: '9px',
    border: `1.5px solid ${BORDER}`, background: bg,
    padding: '10px 14px', fontSize: '14px', color: textColor,
    fontFamily: 'Inter, sans-serif', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = primary
    e.currentTarget.style.boxShadow = `0 0 0 3px ${primary}22`
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = BORDER
    e.currentTarget.style.boxShadow = 'none'
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    const oversized = picked.filter(f => f.size > MAX_FILE_MB * 1024 * 1024)
    if (oversized.length) { setError(`Archivo(s) demasiado grandes. Máximo ${MAX_FILE_MB} MB por archivo.`); return }
    setPendingFiles(prev => [...prev, ...picked])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(i: number) {
    setPendingFiles(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('clientId', clientId)
    fd.set('createdById', createdById)
    setError('')
    startTransition(async () => {
      if (pendingFiles.length > 0) {
        setUploadStatus(`Subiendo ${pendingFiles.length} archivo(s)…`)
        try {
          const uploaded = await uploadFiles(pendingFiles)
          fd.set('uploadedFiles', JSON.stringify(uploaded))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al subir archivos')
          setUploadStatus('')
          return
        }
        setUploadStatus('')
      }
      const res = await createPortalTicket(fd)
      if (!res.success) { setError('Error al crear la solicitud. Inténtalo nuevamente.'); return }
      if (isStaff) {
        router.push(`/tickets/${res.id}`)
      } else {
        router.push(`/portal/${slug}/tickets/${res.id}`)
      }
    })
  }

  const label = (text: string, required?: boolean) => (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: T2, marginBottom: '6px' }}>
      {text}{required && <span style={{ color: primary, marginLeft: '3px' }}>*</span>}
    </label>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Staff banner */}
      {isStaff && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '9px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
            <path d="M8 2L14 13H2L8 2z" fill="#f59e0b"/>
            <path d="M8 7v2.5M8 11.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', margin: 0 }}>Creando ticket en nombre de {clientName}</p>
            <p style={{ fontSize: '11px', color: '#b45309', margin: '3px 0 0' }}>Estás autenticado como INGEGAR. Al enviar, el ticket quedará asignado al cliente y serás redirigido a la vista interna.</p>
          </div>
        </div>
      )}

      {/* Sucursal */}
      <div>
        {label('Sucursal', true)}
        {lockedBranch ? (
          // Branch user: sucursal fijada por su cuenta, no se puede cambiar
          <>
            <input type="hidden" name="branchId" value={lockedBranch.id} />
            <div style={{ ...inp, display: 'flex', alignItems: 'center', gap: '8px', background: `color-mix(in srgb, ${primary} 6%, ${bg})`, borderColor: `color-mix(in srgb, ${primary} 30%, transparent)` }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="5.5" r="2"/><path d="M7 13S2.5 9.5 2.5 5.5a4.5 4.5 0 019 0C11.5 9.5 7 13 7 13z"/></svg>
              <span style={{ fontSize: '14px', fontWeight: '600', color: textColor }}>{lockedBranch.name}{lockedBranch.city ? ` — ${lockedBranch.city}` : ''}</span>
            </div>
          </>
        ) : (
          <select name="branchId" required style={inp} onFocus={focusStyle} onBlur={blurStyle}>
            <option value="">Selecciona la sucursal afectada…</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* Urgencia */}
      <div>
        {label('Nivel de urgencia', true)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {URGENCIES.map(u => (
            <label key={u.value} style={{
              display: 'flex', flexDirection: 'column', gap: '3px',
              padding: '10px 12px', borderRadius: '9px', cursor: 'pointer',
              border: `1.5px solid ${urgency === u.value ? primary : BORDER}`,
              background: urgency === u.value ? `color-mix(in srgb, ${primary} 8%, white)` : bg,
              transition: 'all 0.12s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="radio" name="urgency" value={u.value} checked={urgency === u.value}
                  onChange={() => setUrgency(u.value)} style={{ accentColor: primary, margin: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: textColor }}>{u.label}</span>
              </div>
              <span style={{ fontSize: '11px', color: T3, paddingLeft: '18px' }}>{u.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Categoría */}
      <div>
        {label('Categoría del problema')}
        <select name="category" style={inp} onFocus={focusStyle} onBlur={blurStyle}>
          <option value="">Seleccionar categoría (opcional)…</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Título */}
      <div>
        {label('Título del requerimiento', true)}
        <input type="text" name="title" required placeholder="Ej: Aire acondicionado no enfría en tienda 3"
          style={inp} onFocus={focusStyle} onBlur={blurStyle} />
        <p style={{ fontSize: '11px', color: T3, marginTop: '5px' }}>Sé específico: equipo afectado + síntoma + ubicación.</p>
      </div>

      {/* Descripción */}
      <div>
        {label('Descripción detallada')}
        <textarea name="description" rows={5}
          placeholder="Describe el problema: ¿cuándo comenzó? ¿qué acciones se tomaron? ¿qué equipos o zonas están afectados?"
          style={{ ...inp, resize: 'vertical', minHeight: '100px' }}
          onFocus={focusStyle} onBlur={blurStyle} />
      </div>

      {/* Comentario del cliente */}
      <div>
        {label('Comentario adicional')}
        <textarea name="clientComment" rows={3}
          placeholder="¿Tienes algún detalle, restricción de horario, o información extra que debamos saber?"
          style={{ ...inp, resize: 'vertical', minHeight: '80px' }}
          onFocus={focusStyle} onBlur={blurStyle} />
        <p style={{ fontSize: '11px', color: T3, marginTop: '5px' }}>Opcional — solo visible para ti y el equipo INGEGAR.</p>
      </div>

      {/* Adjuntar archivos */}
      <div>
        {label('Adjuntar archivos')}
        <input ref={fileRef} type="file" multiple accept={ACCEPT} onChange={handleFilePick}
          style={{ display: 'none' }} aria-label="Seleccionar archivos" />
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '9px', border: `1.5px dashed ${BORDER}`, background: bg, color: T2, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10V5.5L7 3.5h4.5a1 1 0 011 1V10M5 10H3a1 1 0 00-1 1v.5A1.5 1.5 0 003.5 13h9a1.5 1.5 0 001.5-1.5V11a1 1 0 00-1-1H5z"/><path d="M7 3.5V6H5"/></svg>
          Adjuntar archivo
        </button>
        <p style={{ fontSize: '11px', color: T3, marginTop: '5px' }}>Imágenes, videos, PDF, Word, Excel. Máximo {MAX_FILE_MB} MB por archivo.</p>
        {pendingFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
            {pendingFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: `color-mix(in srgb, ${primary} 6%, ${bg})`, borderRadius: '7px', border: `1px solid color-mix(in srgb, ${primary} 20%, transparent)` }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12.5h8a1 1 0 001-1V4L9.5 1.5H3a1 1 0 00-1 1v9a1 1 0 001 1z"/><path d="M9.5 1.5V4H12"/></svg>
                <span style={{ fontSize: '12px', color: textColor, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ fontSize: '11px', color: T3 }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: '0 2px', fontSize: '16px', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span>
          <p style={{ fontSize: '13px', color: '#b91c1c', margin: 0, fontWeight: '500' }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
        <button type="submit" disabled={isPending} style={{
          flex: 1, padding: '12px', background: primary, color: '#fff',
          border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '700',
          cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1,
          fontFamily: 'Inter, sans-serif', transition: 'opacity 0.15s', minHeight: '44px',
        }}>
          {uploadStatus || (isPending ? 'Enviando solicitud…' : 'Enviar solicitud →')}
        </button>
        <a href={`/portal/${slug}/tickets`} style={{
          padding: '12px 18px', background: bg, color: T2,
          border: `1.5px solid ${BORDER}`, borderRadius: '9px',
          fontSize: '14px', fontWeight: '600', textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px',
        }}>
          Cancelar
        </a>
      </div>
    </form>
  )
}
