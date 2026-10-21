'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Fades its children in the first time they scroll into view. The hidden
 * state lives in CSS (`.lp-reveal`, globals.css) and only applies while
 * scripting is enabled, so the content never depends on this effect running.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  /** Stagger, in milliseconds. */
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.dataset.in = 'true'
        observer.disconnect()
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn('lp-reveal', className)} style={{ '--d': `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  )
}
