'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function TopProgress() {
  const pathname = usePathname()
  const barRef  = useRef<HTMLDivElement>(null)
  const t1Ref   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t2Ref   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t3Ref   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    // Clear any in-flight timers
    if (t1Ref.current) clearTimeout(t1Ref.current)
    if (t2Ref.current) clearTimeout(t2Ref.current)
    if (t3Ref.current) clearTimeout(t3Ref.current)

    // Phase 1: show bar and animate to ~75%
    bar.className = 'route-progress loading'

    // Phase 2: complete to 100%
    t1Ref.current = setTimeout(() => {
      bar.className = 'route-progress done'

      // Phase 3: fade out
      t2Ref.current = setTimeout(() => {
        bar.className = 'route-progress fade'

        // Phase 4: reset to invisible
        t3Ref.current = setTimeout(() => {
          bar.className = 'route-progress'
        }, 400)
      }, 130)
    }, 120)

    return () => {
      if (t1Ref.current) clearTimeout(t1Ref.current)
      if (t2Ref.current) clearTimeout(t2Ref.current)
      if (t3Ref.current) clearTimeout(t3Ref.current)
    }
  }, [pathname])

  return <div ref={barRef} className="route-progress" aria-hidden="true" />
}
