'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ViewAsUser {
  id: string
  name: string
  role: string
  tenantSlug: string
}

interface Props {
  activeViewName: string | null
  users: ViewAsUser[]
}

export function ViewAsBar({ activeViewName, users }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  async function switchTo(userId: string | null) {
    setOpen(false)
    await fetch('/api/auth/view-as', {
      method: userId ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: userId ? JSON.stringify({ userId }) : undefined,
    })
    startTransition(() => router.refresh())
  }

  if (activeViewName) {
    return (
      <div className="mb-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
        <span aria-hidden>👁</span>
        <span className="flex-1 truncate font-medium">Viendo: {activeViewName}</span>
        <button
          onClick={() => switchTo(null)}
          disabled={isPending}
          className="rounded px-1 font-bold hover:bg-amber-100 transition-colors"
          title="Salir de vista como"
          aria-label="Salir de vista como"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div className="relative mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-400 transition-colors hover:border-brand hover:text-brand"
      >
        <span aria-hidden>👁</span>
        Ver como…
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 max-h-64 w-56 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {users.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">Sin otros usuarios</p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => switchTo(u.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                  <p className="text-xs text-gray-400">
                    {u.role} · {u.tenantSlug}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
