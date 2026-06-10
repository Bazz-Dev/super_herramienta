'use client'

import { PlusIcon, TrashIcon } from './icons'
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
      {items.length === 0 && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400">Sin elementos todavía.</p>
      )}
      {items.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-xs text-gray-400">{i + 1}.</span>
          <TextInput
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((v, idx) => (idx === i ? e.target.value : v)))}
          />
          <IconButton label="Eliminar" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <TrashIcon />
          </IconButton>
        </div>
      ))}
      <div>
        <AddButton onClick={() => onChange([...items, ''])}>
          <PlusIcon /> {addLabel}
        </AddButton>
      </div>
    </div>
  )
}
