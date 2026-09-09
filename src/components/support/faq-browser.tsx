'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronDown, Info, BookOpen, LifeBuoy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FaqItem {
  q: string
  a: string
}

export interface FaqCategory {
  key: string
  title: string
  items: FaqItem[]
}

interface FaqBrowserProps {
  categories: FaqCategory[]
  intro: string
  searchPlaceholder: string
  noResults: string
  allLabel: string
  guideLabel: string
  guideHref: string
  supportLabel: string
  supportHref: string
}

export function FaqBrowser({
  categories,
  intro,
  searchPlaceholder,
  noResults,
  allLabel,
  guideLabel,
  guideHref,
  supportLabel,
  supportHref,
}: FaqBrowserProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return categories
      .filter((category) => !activeCategory || category.key === activeCategory)
      .map((category) => ({
        ...category,
        items: q
          ? category.items.filter(
              (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
            )
          : category.items,
      }))
      .filter((category) => category.items.length > 0)
  }, [categories, query, activeCategory])

  const totalHits = filtered.reduce((sum, category) => sum + category.items.length, 0)

  const chip = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
      active
        ? 'bg-violet-600 text-white'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    )

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border-0 shadow-sm bg-violet-50 dark:bg-violet-950/30 p-4">
        <Info className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <p className="text-sm text-violet-900 dark:text-violet-200 leading-relaxed">{intro}</p>
      </div>

      <div className="rounded-xl border-0 shadow-sm bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveCategory(null)} className={chip(activeCategory === null)}>
            {allLabel} ({categories.reduce((n, c) => n + c.items.length, 0)})
          </button>
          {categories.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => setActiveCategory(category.key === activeCategory ? null : category.key)}
              className={chip(category.key === activeCategory)}
            >
              {category.title} ({category.items.length})
            </button>
          ))}
        </div>
      </div>

      {totalHits === 0 ? (
        <div className="rounded-xl border-0 shadow-sm bg-white dark:bg-slate-900 py-16 text-center text-sm text-muted-foreground">
          {noResults}
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((category) => (
            <section key={category.key}>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                {category.title}
              </h2>
              <div className="space-y-2">
                {category.items.map((item) => {
                  const id = `${category.key}-${item.q}`
                  const isOpen = openQuestion === id
                  return (
                    <div key={id} className="rounded-xl border-0 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenQuestion(isOpen ? null : id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.q}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </button>
                      {isOpen && (
                        <p className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                          {item.a}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={guideHref}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 px-3.5 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {guideLabel}
        </Link>
        <Link
          href={supportHref}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <LifeBuoy className="h-3.5 w-3.5" />
          {supportLabel}
        </Link>
      </div>
    </div>
  )
}
