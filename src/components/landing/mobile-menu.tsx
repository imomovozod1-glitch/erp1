'use client'

import { useState, type ReactNode } from 'react'
import { List, X } from '@phosphor-icons/react'

/**
 * The header's menu below the `md` breakpoint, where the inline nav does not
 * fit. Closes itself when a link is chosen — a plain `<details>` would stay
 * open over the section it just scrolled to.
 */
export function MobileMenu({
  links,
  label,
  children,
}: {
  links: { href: string; label: string }[]
  label: string
  /** Extra controls under the links (the language switcher). */
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-900/5 dark:text-white dark:hover:bg-white/10"
      >
        {open ? <X weight="bold" className="h-5 w-5" /> : <List weight="bold" className="h-5 w-5" />}
      </button>

      {open && (
        // `lp-glass-solid`: an opaque panel, so the page text under it is not readable through it.
        <div className="lp-glass lp-glass-solid absolute inset-x-0 top-16 rounded-3xl p-3">
          <nav className="flex flex-col">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
          {children && <div className="mt-2 flex justify-center border-t border-slate-900/10 pt-3 dark:border-white/10">{children}</div>}
        </div>
      )}
    </div>
  )
}
