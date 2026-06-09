'use client'

import type { QuoteScope } from '@/lib/quotes/types'
import { AddButton, IconButton, TextArea, TextInput } from './ui'

export function ScopeEditor({
  items,
  onChange,
}: {
  items: QuoteScope[]
  onChange: (next: QuoteScope[]) => void
}) {
  function update(i: number, patch: Partial<QuoteScope>) {
    onChange(items.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((s, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <TextInput
              value={s.title}
              placeholder="Título del ítem de alcance"
              onChange={(e) => update(i, { title: e.target.value })}
            />
            <IconButton onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label="Eliminar">
              ✕
            </IconButton>
          </div>
          <TextArea
            value={s.detail}
            rows={2}
            placeholder="Detalle (opcional)"
            className="mt-2"
            onChange={(e) => update(i, { detail: e.target.value })}
          />
        </div>
      ))}
      <div>
        <AddButton onClick={() => onChange([...items, { title: '', detail: '' }])}>
          + Agregar alcance
        </AddButton>
      </div>
    </div>
  )
}
