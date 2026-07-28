'use client'

import { useEffect, useState } from 'react'
import { Spinner } from './spinner'

const DEFAULT_MESSAGES = ['Preparando información…', 'Cargando datos…', 'Ya casi…']

/**
 * Rotating status line for loading states that take a beat (PDF render,
 * aggregations, big lists) — a spinner alone still reads as a frozen screen
 * on a slow connection. Purely a text swap (no moving/scaling element), so
 * it's left out of the app's prefers-reduced-motion animation kill-switch.
 */
export function LoadingMessage({
  messages = DEFAULT_MESSAGES, interval = 1800, className,
}: { messages?: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (messages.length < 2) return
    const id = setInterval(() => setI((prev) => (prev + 1) % messages.length), interval)
    return () => clearInterval(id)
  }, [messages, interval])

  return (
    <div className={`flex items-center justify-center gap-2 text-sm text-gray-400 ${className ?? ''}`}>
      <Spinner size={14} />
      <span>{messages[i % messages.length]}</span>
    </div>
  )
}
