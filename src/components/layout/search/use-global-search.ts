'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EMPTY_RESULTS, MIN_TERM, safeTerm, searchRecords, type Results, type Viewer } from './search-records'

const DEBOUNCE_MS = 250

/** The palette's state: ⌘K / Ctrl+K anywhere, a debounced record search, results cleared the moment they go stale. */
export function useGlobalSearch(viewer: Viewer, lang: string) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>(EMPTY_RESULTS)
  const [searching, setSearching] = useState(false)
  const { role, permissions, userId } = viewer

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      setOpen((current) => !current)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const term = safeTerm(query)
    if (!open || term.length < MIN_TERM) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      const next = await searchRecords(createClient(), term, { role, permissions, userId }, lang)
      if (cancelled) return
      setResults(next)
      setSearching(false)
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open, lang, role, permissions, userId])

  const clear = () => {
    setResults(EMPTY_RESULTS)
    setSearching(false)
  }

  const changeQuery = (value: string) => {
    setQuery(value)
    if (safeTerm(value).length < MIN_TERM) clear()
  }

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) return
    setQuery('')
    clear()
  }

  const go = (href: string) => {
    changeOpen(false)
    router.push(href)
  }

  return { open, setOpen: changeOpen, query, changeQuery, results, searching, go, typed: query.trim().length >= MIN_TERM }
}
