'use client'

import { useState, type FormEvent } from 'react'
import { isValidPhone } from '@/lib/phone-validation'
import type { LeadFormLabels } from '@/components/landing/lead-form'

export type FieldErrors = Partial<Record<'name' | 'company' | 'phone', string>>

const EMPTY = { name: '', company: '', phone: '', comment: '', website: '' }
const MIN_TEXT = 2
const TOO_MANY = 429

type Draft = typeof EMPTY

function validate(draft: Draft, labels: LeadFormLabels): FieldErrors {
  const errors: FieldErrors = {}
  if (draft.name.trim().length < MIN_TEXT) errors.name = labels.errorName
  if (draft.company.trim().length < MIN_TEXT) errors.company = labels.errorCompany
  if (!isValidPhone(draft.phone)) errors.phone = labels.errorPhone
  return errors
}

/**
 * The sign-up request: validated here, posted to /api/leads. `website` is a honeypot —
 * invisible to people, tempting to bots; the server drops anything that fills it.
 */
export function useLeadForm(lang: string, labels: LeadFormLabels) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  // Bumped after a send so the phone input remounts empty.
  const [resetKey, setResetKey] = useState(0)

  const set = (field: keyof Draft) => (value: string) => setDraft((current) => ({ ...current, [field]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (status === 'sending') return
    const found = validate(draft, labels)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return
    setStatus('sending')
    try {
      const body = { name: draft.name.trim(), company: draft.company.trim(), phone: draft.phone, comment: draft.comment.trim() || undefined, lang, website: draft.website }
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) return setStatus('done')
      setFormError(res.status === TOO_MANY ? labels.errorLimit : labels.errorGeneric)
    } catch {
      setFormError(labels.errorGeneric)
    }
    setStatus('idle')
  }

  const reset = () => {
    setDraft(EMPTY)
    setErrors({})
    setFormError(null)
    setResetKey((key) => key + 1)
    setStatus('idle')
  }

  return { draft, set, errors, formError, status, resetKey, submit, reset }
}
