'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type ComboOption = { value: string; label: string; sublabel?: string; recentAt?: Date }

const MAX_RESULTS = 20

interface Props {
  name: string
  defaultValue?: string
  placeholder?: string
  options?: ComboOption[]
  search?: (query: string) => Promise<ComboOption[]>
  required?: boolean
  className?: string
}

// Reemplazo directo de <select> pero buscable — mismo contrato (name +
// defaultValue, funciona dentro de un <form> normal con Server Actions).
// Dos modos: `options` precargado (filtra en memoria, listas chicas) o
// `search` async (Server Action, listas grandes — debounce + descarta
// resultados obsoletos si llega una tecla nueva antes de resolver).
export function SearchableCombobox({ name, defaultValue, placeholder, options, search, required, className }: Props) {
  const initialLabel = options?.find((o) => o.value === defaultValue)?.label ?? ''
  const [value, setValue] = useState(defaultValue ?? '')
  const [query, setQuery] = useState(initialLabel)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ComboOption[]>(options?.slice(0, MAX_RESULTS) ?? [])
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filteredOptions = useMemo(() => {
    if (!options) return null
    const q = query.trim().toLowerCase()
    const base = !q
      ? [...options].sort((a, b) => (b.recentAt?.getTime() ?? 0) - (a.recentAt?.getTime() ?? 0))
      : options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q))
    return base.slice(0, MAX_RESULTS)
  }, [options, query])

  useEffect(() => {
    if (filteredOptions) { setResults(filteredOptions); return }
    if (!search) return
    const id = ++requestId.current
    const t = setTimeout(() => {
      search(query.trim()).then((r) => { if (requestId.current === id) setResults(r.slice(0, MAX_RESULTS)) })
    }, 150)
    return () => clearTimeout(t)
  }, [query, search, filteredOptions])

  function select(opt: ComboOption) {
    setValue(opt.value)
    setQuery(opt.label)
    setOpen(false)
    setActiveIndex(-1)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[activeIndex]) select(results[activeIndex]) }
    else if (e.key === 'Escape') { setOpen(false); setActiveIndex(-1) }
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <input type="hidden" name={name} value={value} required={required} />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${name}-listbox`}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setValue(''); setOpen(true); setActiveIndex(-1) }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      {open && (
        <ul
          id={`${name}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full min-w-[220px] overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
          ) : results.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={(e) => { e.preventDefault(); select(opt) }}
              className={`cursor-pointer px-3 py-1.5 text-sm ${i === activeIndex ? 'bg-brand/15' : 'hover:bg-gray-50'}`}
            >
              <div className="text-ink">{opt.label}</div>
              {opt.sublabel && <div className="text-xs text-gray-400">{opt.sublabel}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
