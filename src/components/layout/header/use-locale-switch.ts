'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const PENDING_KEY = 'pending_form_data'
const RESTORE_DELAY_MS = 300

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const isChoice = (input: Field) => input.type === 'checkbox' || input.type === 'radio'
const pathWithout = (lang: string) => window.location.pathname.replace(`/${lang}`, '')

function collectFields() {
  const fields: Record<string, string> = {}
  document.querySelectorAll<Field>('input, select, textarea').forEach((input) => {
    if (!input.name || ['submit', 'button', 'hidden'].includes(input.type)) return
    if (!isChoice(input) || (input as HTMLInputElement).checked) fields[input.name] = input.value
  })
  return fields
}

function applyFields(fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) {
    document.querySelectorAll<Field>(`[name="${name}"]`).forEach((input) => {
      if (isChoice(input)) (input as HTMLInputElement).checked = input.value === value
      else input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }
}

/**
 * A locale switch remounts the whole tree under [lang], so unsaved form input is parked in
 * sessionStorage and put back on the same page once it renders in the new language.
 */
export function useLocaleSwitch(lang: string) {
  const router = useRouter()

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null')
      if (!saved) return
      if (saved.path !== pathWithout(lang)) return void sessionStorage.removeItem(PENDING_KEY)
      const timer = setTimeout(() => {
        applyFields(saved.fields)
        sessionStorage.removeItem(PENDING_KEY)
      }, RESTORE_DELAY_MS)
      return () => clearTimeout(timer)
    } catch (error) {
      console.error('Error restoring form data', error)
    }
  }, [lang])

  return (locale: string) => {
    const fields = collectFields()
    if (Object.keys(fields).length > 0) sessionStorage.setItem(PENDING_KEY, JSON.stringify({ path: pathWithout(lang), fields }))
    router.replace(`/${locale}${pathWithout(lang)}`)
  }
}
