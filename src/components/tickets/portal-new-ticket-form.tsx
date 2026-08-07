'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortalTicket } from '@/app/portal/[slug]/tickets/actions'
import { uploadDirect } from '@/lib/upload-direct'

const ACCEPT = 'image/*,video/mp4,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx'
const MAX_FILE_MB = 50

type UploadedFile = { key: string; name: string; mimeType: string }

async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const results: UploadedFile[] = []
  for (const file of files) {
    try {
      const { key, contentType } = await uploadDirect('/api/portal-upload', file)
      results.push({ key, name: file.name, mimeType: contentType })
    } catch {
      throw new Error(`Error al subir ${file.name}`)
    }
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

const MODALIDADES = [
  { value: 'pre_quote',      label: 'Necesito cotización primero', desc: 'Quieres el precio antes de que vayamos a resolverlo' },
  { value: 'post_execution', label: 'Es urgente, resuelvan y después vemos el costo', desc: 'Autorizas que vayamos primero, la valorización llega después' },
]

const CATEGORIES = [
  'Climatización', 'Campana extractora', 'Electricidad', 'Plomería / agua',
  'Refrigeración', 'Gas', 'Estructural / obra civil', 'Equipamiento de cocina',
  'Seguridad / CCTV', 'Iluminación', 'Otro',
]

const T2 = 'rgba(24,19,14,0.55)'
const T3 = 'rgba(24,19,14,0.40)'
const BORDER = 'rgba(24,19,14,0.15)'

// Un requerimiento = un problema reportado dentro del mismo ticket (FASE 2
// del brief). files vive como File[] en memoria hasta el envío final --
// mismo criterio que el formulario de un solo requerimiento de antes, ahora
// uno por requerimiento en vez de uno global.
interface Draft {
  category: string
  title: string
  description: string
  comment: string
  files: File[]
}
interface SavedRequirement extends Draft {
  key: string // React key estable, independiente de la posición en el array
}

const EMPTY_DRAFT: Draft = { category: '', title: '', description: '', comment: '', files: [] }

export function PortalNewTicketForm({ slug, clientId, clientName, createdById, branches, defaultBranchId, primary, bg, textColor, isStaff }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [urgency, setUrgency] = useState('no_urgente')
  const [processFlow, setProcessFlow] = useState<'pre_quote' | 'post_execution'>('pre_quote')
  const [uploadStatus, setUploadStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const lockedBranch = defaultBranchId ? branches.find(b => b.id === defaultBranchId) : null
  const [branchId, setBranchId] = useState(lockedBranch?.id ?? '')

  const [requirements, setRequirements] = useState<SavedRequirement[]>([])
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showDraftForm, setShowDraftForm] = useState(true)
  const [savedPromptOpen, setSavedPromptOpen] = useState(false)
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)

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
    setDraft(d => ({ ...d, files: [...d.files, ...picked] }))
    if (fileRef.current) fileRef.current.value = ''
  }
  function removeDraftFile(i: number) {
    setDraft(d => ({ ...d, files: d.files.filter((_, idx) => idx !== i) }))
  }

  function saveRequirement() {
    if (!draft.title.trim()) { setError('Escribe un título para el requerimiento'); return }
    setError('')
    if (editingKey) {
      setRequirements(reqs => reqs.map(r => r.key === editingKey ? { ...draft, key: editingKey } : r))
    } else {
      setRequirements(reqs => [...reqs, { ...draft, key: `${Date.now()}-${reqs.length}` }])
    }
    setDraft(EMPTY_DRAFT)
    setEditingKey(null)
    setShowDraftForm(false)
    setSavedPromptOpen(true)
  }

  function editRequirement(key: string) {
    const r = requirements.find(x => x.key === key)
    if (!r) return
    setDraft({ category: r.category, title: r.title, description: r.description, comment: r.comment, files: r.files })
    setEditingKey(key)
    setShowDraftForm(true)
    setSavedPromptOpen(false)
  }
  function deleteRequirement(key: string) {
    setRequirements(reqs => reqs.filter(r => r.key !== key))
    setConfirmDeleteKey(null)
  }
  function addAnother() {
    setDraft(EMPTY_DRAFT)
    setEditingKey(null)
    setShowDraftForm(true)
    setSavedPromptOpen(false)
  }

  function submitTicket() {
    if (requirements.length === 0) { setError('Agrega al menos un requerimiento antes de enviar.'); return }
    if (!branchId) { setError('Selecciona la sucursal afectada.'); return }
    setError('')
    startTransition(async () => {
      try {
        const withUploads = []
        for (let i = 0; i < requirements.length; i++) {
          const r = requirements[i]
          if (r.files.length > 0) setUploadStatus(`Subiendo archivos (${i + 1}/${requirements.length})…`)
          const uploaded = r.files.length > 0 ? await uploadFiles(r.files) : []
          withUploads.push({
            category: r.category || undefined,
            title: r.title,
            description: r.description || undefined,
            comment: r.comment || undefined,
            files: uploaded,
          })
        }
        setUploadStatus('')
        const res = await createPortalTicket({
          clientId, createdById, branchId, urgency, processFlow,
          requirements: withUploads,
        })
        if (!res.success) { setError('Error al crear la solicitud. Inténtalo nuevamente.'); return }
        // revalidatePath del server action solo invalida el cache de servidor —
        // sin esto, volver a /tickets o al portal vía un <Link> muestra el
        // Router Cache del cliente, que todavía no tiene la solicitud nueva.
        router.refresh()
        if (isStaff) {
          router.push(`/tickets/${res.id}`)
        } else {
          router.push(`/portal/${slug}/tickets/${res.id}`)
        }
      } catch (err) {
        setUploadStatus('')
        setError(err instanceof Error ? err.message : 'Error al crear la solicitud. Inténtalo nuevamente.')
      }
    })
  }

  const label = (text: string, required?: boolean) => (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: T2, marginBottom: '6px' }}>
      {text}{required && <span style={{ color: primary, marginLeft: '3px' }}>*</span>}
    </label>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

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

      {/* Datos generales del ticket — se ingresan una sola vez */}
      <div>
        {label('Sucursal', true)}
        {lockedBranch ? (
          <div style={{ ...inp, display: 'flex', alignItems: 'center', gap: '8px', background: `color-mix(in srgb, ${primary} 6%, ${bg})`, borderColor: `color-mix(in srgb, ${primary} 30%, transparent)` }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="5.5" r="2"/><path d="M7 13S2.5 9.5 2.5 5.5a4.5 4.5 0 019 0C11.5 9.5 7 13 7 13z"/></svg>
            <span style={{ fontSize: '14px', fontWeight: '600', color: textColor }}>{lockedBranch.name}{lockedBranch.city ? ` — ${lockedBranch.city}` : ''}</span>
          </div>
        ) : (
          <select name="branchId" value={branchId} onChange={e => setBranchId(e.target.value)} required style={inp} onFocus={focusStyle} onBlur={blurStyle}>
            <option value="">Selecciona la sucursal afectada…</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>
            ))}
          </select>
        )}
      </div>

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

      <div>
        {label('¿Cómo prefieres avanzar?', true)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {MODALIDADES.map(m => (
            <label key={m.value} style={{
              display: 'flex', flexDirection: 'column', gap: '3px',
              padding: '10px 12px', borderRadius: '9px', cursor: 'pointer',
              border: `1.5px solid ${processFlow === m.value ? primary : BORDER}`,
              background: processFlow === m.value ? `color-mix(in srgb, ${primary} 8%, white)` : bg,
              transition: 'all 0.12s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="radio" name="processFlow" value={m.value} checked={processFlow === m.value}
                  onChange={() => setProcessFlow(m.value as 'pre_quote' | 'post_execution')} style={{ accentColor: primary, margin: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: textColor }}>{m.label}</span>
              </div>
              <span style={{ fontSize: '11px', color: T3, paddingLeft: '18px' }}>{m.desc}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ height: '1px', background: BORDER, margin: '2px 0' }} />

      {/* Requerimientos ya guardados */}
      {requirements.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: '700', color: T2, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Requerimientos ({requirements.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {requirements.map((r, i) => (
              <div key={r.key} style={{ border: `1.5px solid ${BORDER}`, borderRadius: '10px', padding: '12px 14px', background: bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: textColor, margin: 0 }}>
                    {i + 1}. {r.category ? `${r.category} — ` : ''}{r.title}
                  </p>
                  {r.files.length > 0 && (
                    <p style={{ fontSize: '11px', color: T3, margin: '3px 0 0' }}>{r.files.length} archivo{r.files.length !== 1 ? 's' : ''} adjunto{r.files.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
                {confirmDeleteKey === r.key ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '600' }}>¿Eliminar?</span>
                    <button type="button" onClick={() => setConfirmDeleteKey(null)} style={{ minHeight: '44px', padding: '5px 10px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', fontSize: '11px', cursor: 'pointer', color: T2 }}>No</button>
                    <button type="button" onClick={() => deleteRequirement(r.key)} style={{ minHeight: '44px', padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Sí, eliminar</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button type="button" onClick={() => editRequirement(r.key)} style={{ minHeight: '44px', padding: '5px 10px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', fontSize: '11px', fontWeight: '600', cursor: 'pointer', color: T2 }}>Editar</button>
                    <button type="button" onClick={() => setConfirmDeleteKey(r.key)} style={{ minHeight: '44px', padding: '5px 10px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', fontSize: '11px', fontWeight: '600', cursor: 'pointer', color: '#b91c1c' }}>Eliminar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulario del requerimiento actual */}
      {showDraftForm && (
        <div style={{ border: `1.5px dashed ${BORDER}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', color: T2, textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
            {editingKey ? 'Editando requerimiento' : `Nuevo requerimiento${requirements.length > 0 ? ` (${requirements.length + 1})` : ''}`}
          </p>

          <div>
            {label('Categoría del problema')}
            <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={inp} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="">Seleccionar categoría (opcional)…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            {label('Título del requerimiento', true)}
            <input type="text" name="title" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="Ej: Aire acondicionado no enfría en tienda 3"
              style={inp} onFocus={focusStyle} onBlur={blurStyle} />
            <p style={{ fontSize: '11px', color: T3, marginTop: '5px' }}>Sé específico: equipo afectado + síntoma + ubicación.</p>
          </div>

          <div>
            {label('Descripción detallada')}
            <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={4}
              placeholder="Describe el problema: ¿cuándo comenzó? ¿qué acciones se tomaron? ¿qué equipos o zonas están afectados?"
              style={{ ...inp, resize: 'vertical', minHeight: '90px' }}
              onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div>
            {label('Comentario adicional')}
            <textarea value={draft.comment} onChange={e => setDraft(d => ({ ...d, comment: e.target.value }))} rows={2}
              placeholder="¿Tienes algún detalle, restricción de horario, o información extra que debamos saber?"
              style={{ ...inp, resize: 'vertical', minHeight: '70px' }}
              onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div>
            {label('Archivos de este requerimiento')}
            <input ref={fileRef} type="file" multiple accept={ACCEPT} onChange={handleFilePick}
              style={{ display: 'none' }} aria-label="Seleccionar archivos" />
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '9px', border: `1.5px dashed ${BORDER}`, background: bg, color: T2, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10V5.5L7 3.5h4.5a1 1 0 011 1V10M5 10H3a1 1 0 00-1 1v.5A1.5 1.5 0 003.5 13h9a1.5 1.5 0 001.5-1.5V11a1 1 0 00-1-1H5z"/><path d="M7 3.5V6H5"/></svg>
              Adjuntar archivo
            </button>
            <p style={{ fontSize: '11px', color: T3, marginTop: '5px' }}>Imágenes, videos, PDF, Word, Excel. Máximo {MAX_FILE_MB} MB por archivo. Estos archivos quedan asociados solo a este requerimiento.</p>
            {draft.files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
                {draft.files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: `color-mix(in srgb, ${primary} 6%, ${bg})`, borderRadius: '7px', border: `1px solid color-mix(in srgb, ${primary} 20%, transparent)` }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12.5h8a1 1 0 001-1V4L9.5 1.5H3a1 1 0 00-1 1v9a1 1 0 001 1z"/><path d="M9.5 1.5V4H12"/></svg>
                    <span style={{ fontSize: '12px', color: textColor, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ fontSize: '11px', color: T3 }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => removeDraftFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: '0 2px', fontSize: '16px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={saveRequirement} style={{
              padding: '10px 18px', background: primary, color: '#fff', border: 'none', borderRadius: '9px',
              fontSize: '13px', fontWeight: '700', cursor: 'pointer', minHeight: '44px',
            }}>
              Guardar requerimiento
            </button>
            {(editingKey || requirements.length > 0) && (
              <button type="button" onClick={() => { setDraft(EMPTY_DRAFT); setEditingKey(null); setShowDraftForm(false) }} style={{
                padding: '10px 16px', background: 'transparent', color: T2, border: `1.5px solid ${BORDER}`, borderRadius: '9px',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
              }}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Agregar otro / enviar */}
      {!showDraftForm && requirements.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={addAnother} style={{
            padding: '10px 16px', background: 'transparent', color: primary, border: `1.5px solid ${primary}`, borderRadius: '9px',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer', minHeight: '44px',
          }}>
            + Agregar otro requerimiento
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span>
          <p style={{ fontSize: '13px', color: '#b91c1c', margin: 0, fontWeight: '500' }}>{error}</p>
        </div>
      )}

      {!showDraftForm && (
        <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
          <button type="button" onClick={submitTicket} disabled={isPending || requirements.length === 0} style={{
            flex: 1, padding: '12px', background: primary, color: '#fff',
            border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '700',
            cursor: isPending || requirements.length === 0 ? 'not-allowed' : 'pointer',
            opacity: isPending || requirements.length === 0 ? 0.6 : 1,
            fontFamily: 'Inter, sans-serif', transition: 'opacity 0.15s', minHeight: '44px',
          }}>
            {uploadStatus || (isPending ? 'Enviando solicitud…' : 'Confirmar y enviar ticket →')}
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
      )}

      {/* Modal: "Requerimiento guardado correctamente" */}
      {savedPromptOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', maxWidth: '380px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', color: textColor, margin: '0 0 6px' }}>✓ Requerimiento guardado correctamente</p>
            <p style={{ fontSize: '13px', color: T2, margin: '0 0 18px' }}>¿Qué deseas hacer ahora?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="button" onClick={addAnother} style={{
                padding: '11px', background: primary, color: '#fff', border: 'none', borderRadius: '9px',
                fontSize: '13px', fontWeight: '700', cursor: 'pointer', minHeight: '44px',
              }}>
                Agregar otro requerimiento
              </button>
              <button type="button" onClick={() => setSavedPromptOpen(false)} style={{
                padding: '11px', background: 'transparent', color: T2, border: `1.5px solid ${BORDER}`, borderRadius: '9px',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
              }}>
                Revisar y enviar ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
