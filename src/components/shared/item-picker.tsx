'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * One row in the picker's list.
 *
 * Deliberately pre-formatted strings rather than raw numbers: money and
 * quantities are formatted differently per caller (a purchase shows a cost, a
 * sale shows a price, a recipe shows a unit cost), and pushing that decision
 * into the picker would mean it had to know about all three.
 */
export interface PickableOption {
  id: string
  name: string
  /** Second line under the name — stock on hand, unit, "service". */
  meta?: string
  /** Right-hand figure — a price or a cost. */
  trailing?: string
  /** Already on the list: shown as a count badge. Clicking still bumps it. */
  badge?: string | number | null
  /** Nothing left on the shelf, or otherwise unusable right now. */
  disabled?: boolean
  /** Searched alongside the name — a SKU or code. */
  keywords?: string
}

interface ItemPickerProps {
  options: PickableOption[]
  /**
   * Called with the clicked row. Return `false` to keep the list open and the
   * search text where it was — for a refusal the user needs to act on, where
   * closing would make them start the search over.
   */
  onPick: (option: PickableOption) => void | false
  placeholder: string
  /** Shown when the search matches nothing. */
  emptyLabel: string
  /** One line under the box explaining that a click is all it takes. */
  hint?: string
  disabled?: boolean
}

/**
 * Search-and-click item picker.
 *
 * ONE CLICK ADDS THE ROW. This replaces the select → type a quantity → press
 * "Add" sequence that every line-item form used to carry: picking the thing and
 * saying how much of it are two different decisions, and only the first one
 * belongs at the top of the form. Quantity is edited in the table afterwards,
 * where the line can be seen next to the others.
 *
 * Built on a plain input rather than the Popover/Command primitives because the
 * trigger IS the text box: a popover takes focus off it and typing stops
 * working. Extracted from `sale-form.tsx`, which is where the pattern was
 * proven; `bom-form.tsx`, `production-order-form.tsx` and
 * `purchase-order-form.tsx` now share it.
 */
export function ItemPicker({
  options,
  onPick,
  placeholder,
  emptyLabel,
  hint,
  disabled = false,
}: ItemPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Click-outside and Escape close the list. On the document rather than via a
  // primitive, for the focus reason in the docstring above.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  /**
   * The whole list is browsable by scrolling, capped at 200 rows so a tenant
   * with thousands of products does not mint thousands of DOM nodes on every
   * keystroke — past that, typing two letters beats scrolling anyway.
   */
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matches = needle
      ? options.filter(
          (o) =>
            o.name.toLowerCase().includes(needle) || (o.keywords ?? '').toLowerCase().includes(needle)
        )
      : options
    return matches.slice(0, 200)
  }, [options, search])

  const pick = (option: PickableOption) => {
    if (onPick(option) === false) return
    setSearch('')
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="relative" ref={boxRef}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          className="h-9 pl-9"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
        />

        {open && !disabled && (
          /* Exactly three rows tall, then it scrolls. 172px = 3 × h-14 (56px)
             + the 2 dividers + the container's own 1px top and bottom border,
             because box-sizing is border-box. Fixed-height rows are what makes
             that arithmetic hold — with rows that size themselves to their
             text, "three rows" would drift with every long name. */
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[172px] overflow-y-auto rounded-lg border bg-white shadow-lg dark:bg-slate-900">
            {visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <ul className="divide-y">
                {visible.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => pick(option)}
                      disabled={option.disabled}
                      className="flex h-14 w-full items-center justify-between gap-3 px-3 text-left transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-violet-950/20"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {option.name}
                          {option.badge != null && option.badge !== '' && (
                            <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                              {option.badge}
                            </span>
                          )}
                        </span>
                        {option.meta && (
                          <span className="block truncate text-xs text-muted-foreground">{option.meta}</span>
                        )}
                      </span>
                      {option.trailing && (
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {option.trailing}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}
