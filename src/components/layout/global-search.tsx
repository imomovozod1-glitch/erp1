'use client'

import { useMemo } from 'react'
import { Loader2, Search, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { SOURCES, type Hit } from '@/components/layout/search/search-records'
import { NAV_TARGETS } from '@/components/layout/search/search-targets'
import { useGlobalSearch } from '@/components/layout/search/use-global-search'
import { hasViewAccess } from '@/lib/permissions'

interface GlobalSearchProps {
  lang: string
  role: string | null | undefined
  permissions: unknown
  /** Current user, for modules whose data scope is limited to their own records. */
  userId: string | null
}

const MAX_PAGES = 6

function usePages(query: string, role: GlobalSearchProps['role'], permissions: unknown) {
  const t = useTranslations()
  return useMemo(() => {
    const needle = query.trim().toLowerCase()
    const pages = NAV_TARGETS.filter((target) => !target.module || hasViewAccess(role, permissions, target.module)).map((target) => ({ ...target, text: t(target.label) }))
    return (needle ? pages.filter((page) => page.text.toLowerCase().includes(needle)) : pages).slice(0, MAX_PAGES)
  }, [query, role, permissions, t])
}

function HitGroup({ heading, hits, icon: Icon, onGo }: { heading: string; hits: Hit[]; icon: LucideIcon; onGo: (href: string) => void }) {
  if (hits.length === 0) return null
  return (
    <CommandGroup heading={heading}>
      {hits.map((hit) => (
        <CommandItem key={hit.id} value={`${heading}-${hit.id}`} onSelect={() => onGo(hit.href)} className="gap-3 py-2">
          <Icon className="text-muted-foreground" />
          <span className="truncate">{hit.title}</span>
          {hit.subtitle && <span className="ml-auto truncate text-xs text-muted-foreground">{hit.subtitle}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

function SearchTriggers({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations('common')
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="hidden h-10 w-64 min-w-0 shrink items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 text-left text-sm text-muted-foreground shadow-2xs transition-colors hover:border-violet-300 hover:bg-violet-50/50 md:order-first md:flex lg:w-80 xl:w-96 dark:hover:border-violet-700 dark:hover:bg-violet-950/30"
      >
        <Search className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t('searchPlaceholder')}</span>
        <kbd className="hidden h-6 shrink-0 items-center rounded-md border bg-card px-2 font-mono text-[11px] text-muted-foreground lg:inline-flex">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('search')}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-violet-50 md:hidden dark:hover:bg-violet-500/15"
      >
        <Search className="size-4" />
      </button>
    </>
  )
}

/** Quick search: jump to a page, or to a product, customer, supplier, order or invoice. */
export function GlobalSearch({ lang, role, permissions, userId }: GlobalSearchProps) {
  const t = useTranslations()
  const search = useGlobalSearch({ role, permissions, userId }, lang)
  const pages = usePages(search.query, role, permissions)
  const hitCount = Object.values(search.results).reduce((sum, hits) => sum + hits.length, 0)
  return (
    <>
      <SearchTriggers onOpen={() => search.setOpen(true)} />
      <CommandDialog open={search.open} onOpenChange={search.setOpen} title={t('common.search')} description={t('common.searchPlaceholder')} className="sm:max-w-xl">
        {/* Remote hits are already filtered by the database; cmdk's own filter would drop them. */}
        <Command shouldFilter={false}>
          <CommandInput autoFocus value={search.query} onValueChange={search.changeQuery} placeholder={t('common.searchPlaceholder')} wrapperClassName="p-2 pb-1" groupClassName="h-11! text-base" className="text-base sm:text-sm" />
          <CommandList>
            {search.searching && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> {t('common.loading')}
              </div>
            )}
            {!search.searching && search.typed && hitCount === 0 && pages.length === 0 && <CommandEmpty>{t('common.noResults')}</CommandEmpty>}
            {pages.length > 0 && (
              <CommandGroup heading={t('common.pages')}>
                {pages.map(({ href, icon: Icon, text }) => (
                  <CommandItem key={href} value={`page-${href}`} className="gap-3 py-2" onSelect={() => search.go(`/${lang}/${href}`)}>
                    <Icon className="text-muted-foreground" />
                    <span>{text}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {SOURCES.map((source) => (
              <HitGroup key={source.key} heading={t(source.heading)} hits={search.results[source.key]} icon={source.icon} onGo={search.go} />
            ))}
            {!search.typed && <p className="px-3 py-2.5 text-xs text-muted-foreground">{t('common.searchHint')}</p>}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
