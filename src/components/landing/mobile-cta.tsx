'use client'

import { useEffect, useState } from 'react'
import { Phone } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/** How far the visitor must scroll before the bar appears — past the hero's own buttons. */
const SHOW_AFTER_PX = 520

/**
 * A bar pinned to the bottom of the screen on phones: the sign-up button and a
 * one-tap call. It stays out of the way until the hero's own buttons have
 * scrolled off, and goes again while the form itself is on screen — there it
 * would only cover the thing it points to. Hidden from `md` up, where the
 * header is always in view.
 */
export function MobileCta({
  label,
  callLabel,
  phoneHref,
  target = '#start',
}: {
  label: string
  callLabel: string
  phoneHref: string
  /** Hash of the section the main button scrolls to (and that hides the bar). */
  target?: string
}) {
  const [pastHero, setPastHero] = useState(false)
  const [formInView, setFormInView] = useState(false)

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setPastHero(window.scrollY > SHOW_AFTER_PX)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const form = document.querySelector(target)
    const observer = form
      ? new IntersectionObserver(([entry]) => setFormInView(entry.isIntersecting), { threshold: 0.15 })
      : null
    if (form) observer?.observe(form)

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [target])

  const visible = pastHero && !formInView

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 transition-all duration-300 md:hidden',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      )}
      // Not focusable while off-screen.
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="lp-glass flex items-center gap-2 rounded-full p-1.5">
        <a
          href={target}
          className="flex h-11 flex-1 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-lg shadow-violet-500/30"
        >
          {label}
        </a>
        <a
          href={phoneHref}
          aria-label={callLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900"
        >
          <Phone weight="fill" className="h-5 w-5" />
        </a>
      </div>
    </div>
  )
}
