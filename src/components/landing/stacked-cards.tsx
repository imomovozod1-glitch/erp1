'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/** Distance, in px, between the stuck tops of neighbouring cards (see `top` in landing-page.tsx). */
const STEP = 20

/**
 * A pile of `position: sticky` cards: each one sticks a little lower than the
 * one before, so scrolling lays them over each other. This adds the depth —
 * as the next card slides over, the one beneath shrinks and dims, driven by
 * `--p` (0 → 1) on every `[data-stack-card]` child. Pure DOM writes in a
 * rAF-throttled scroll handler: no React state, so nothing re-renders.
 */
export function StackedCards({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-stack-card]'))
    let frame = 0

    const update = () => {
      frame = 0
      cards.forEach((card, i) => {
        const next = cards[i + 1]
        if (!next) return
        const gap = next.getBoundingClientRect().top - card.getBoundingClientRect().top
        const travel = card.offsetHeight + 24 - STEP // gap when the next card has not started to cover this one
        const progress = Math.min(1, Math.max(0, 1 - (gap - STEP) / travel))
        card.style.setProperty('--p', progress.toFixed(3))
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
