'use client'

import { AddButton, IconButton, TextInput } from './ui'

export function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  addLabel: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-right text-xs text-gray-400">{i + 1}.</span>
          <TextInput
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((v, idx) => (idx === i ? e.target.value : v)))}
          />
          <IconButton onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label="Eliminar">
            ✕
          </IconButton>
        </div>
      ))}
      <div>
        <AddButton onClick={() => onChange([...items, ''])}>+ {addLabel}</AddButton>
      </div>
    </div>
  )
}
