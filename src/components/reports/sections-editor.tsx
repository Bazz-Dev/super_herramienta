'use client'

import type { ReportSection } from '@/lib/reports/types'
import { PlusIcon, TrashIcon } from '@/components/quotes/icons'
import { StringListEditor } from '@/components/quotes/string-list-editor'
import { AddButton, Field, IconButton, TextArea, TextInput } from '@/components/quotes/ui'

function emptySection(): ReportSection {
  return { title: '', body: '', bullets: [] }
}

export function SectionsEditor({
  sections,
  onChange,
}: {
  sections: ReportSection[]
  onChange: (next: ReportSection[]) => void
}) {
  const update = (i: number, patch: Partial<ReportSection>) =>
    onChange(sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= sections.length) return
    const next = [...sections]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.length === 0 && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400">Sin secciones todavía.</p>
      )}

      {sections.map((s, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-ink px-1.5 text-xs font-bold text-brand">
              {i + 1}
            </span>
            <div className="flex-1">
              <TextInput
                value={s.title}
                placeholder="Título de la sección (ej. Alcance del servicio)"
                onChange={(e) => update(i, { title: e.target.value })}
              />
            </div>
            <IconButton label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp />
            </IconButton>
            <IconButton label="Bajar" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown />
            </IconButton>
            <IconButton label="Eliminar sección" onClick={() => onChange(sections.filter((_, idx) => idx !== i))}>
              <TrashIcon />
            </IconButton>
          </div>

          <Field label="Texto (opcional)">
            <TextArea
              rows={3}
              value={s.body}
              placeholder="Párrafo introductorio de la sección…"
              onChange={(e) => update(i, { body: e.target.value })}
            />
          </Field>

          <div className="mt-2">
            <p className="mb-1.5 text-xs font-medium text-gray-600">Viñetas (opcional)</p>
            <StringListEditor
              items={s.bullets}
              onChange={(bullets) => update(i, { bullets })}
              addLabel="Agregar viñeta"
              placeholder="Detalle…"
            />
          </div>
        </div>
      ))}

      <div>
        <AddButton onClick={() => onChange([...sections, emptySection()])}>
          <PlusIcon /> Agregar sección
        </AddButton>
      </div>
    </div>
  )
}

function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}
function ArrowDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}
