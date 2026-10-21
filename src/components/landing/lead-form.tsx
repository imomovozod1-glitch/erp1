'use client'

import { useState, type FormEvent } from 'react'
import { CheckCircle, CircleNotch, PaperPlaneTilt, Phone } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PhoneInput } from '@/components/ui/phone-input'
import { authInputClass, authPhoneInputClasses } from '@/components/auth/auth-card'
import { isValidPhone } from '@/lib/phone-validation'
import { cn } from '@/lib/utils'

export interface LeadFormLabels {
  name: string
  namePlaceholder: string
  company: string
  companyPlaceholder: string
  phone: string
  comment: string
  commentPlaceholder: string
  submit: string
  sending: string
  successTitle: string
  successText: string
  sendAnother: string
  errorName: string
  errorCompany: string
  errorPhone: string
  errorGeneric: string
  errorLimit: string
  orCall: string
}

type FieldErrors = Partial<Record<'name' | 'company' | 'phone', string>>

/**
 * The landing page's sign-up request form. Text comes in as props because the
 * `landing` namespace is server-only (it is filtered out of the client
 * messages in src/app/[lang]/layout.tsx).
 *
 * Posts to /api/leads; the request is stored in `leads` and shows up in the
 * super-admin console under "Zayavkalar".
 */
export function LeadForm({
  lang,
  labels,
  phone,
}: {
  lang: string
  labels: LeadFormLabels
  /** The company's own number, shown under the form as an alternative. */
  phone: { href: string; label: string }
}) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phoneValue, setPhoneValue] = useState('')
  const [comment, setComment] = useState('')
  // Honeypot: invisible to people, tempting to bots. The server drops any
  // submission that has it filled.
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  // Bumped after a successful send so the uncontrolled-ish PhoneInput remounts empty.
  const [resetKey, setResetKey] = useState(0)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (status === 'sending') return

    const next: FieldErrors = {}
    if (name.trim().length < 2) next.name = labels.errorName
    if (company.trim().length < 2) next.company = labels.errorCompany
    if (!isValidPhone(phoneValue)) next.phone = labels.errorPhone
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return

    setStatus('sending')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, phone: phoneValue, comment: comment || undefined, lang, website }),
      })
      if (!res.ok) {
        setFormError(res.status === 429 ? labels.errorLimit : labels.errorGeneric)
        setStatus('idle')
        return
      }
      setStatus('done')
    } catch {
      setFormError(labels.errorGeneric)
      setStatus('idle')
    }
  }

  function reset() {
    setName('')
    setCompany('')
    setPhoneValue('')
    setComment('')
    setErrors({})
    setFormError(null)
    setResetKey((key) => key + 1)
    setStatus('idle')
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center py-10 text-center" role="status">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <CheckCircle weight="duotone" className="h-9 w-9" />
        </span>
        <h3 className="mt-5 text-2xl font-bold">{labels.successTitle}</h3>
        <p className="mt-2 text-slate-300">{labels.successText}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 text-sm font-medium text-violet-300 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          {labels.sendAnother}
        </button>
      </div>
    )
  }

  const fieldError = (message?: string) => message && <p className="mt-1.5 text-xs text-red-400">{message}</p>

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="lead-name" className="mb-1.5 text-slate-300">{labels.name}</Label>
          <Input
            id="lead-name"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.namePlaceholder}
            aria-invalid={Boolean(errors.name)}
            className={cn(authInputClass, errors.name && 'border-red-500/50')}
          />
          {fieldError(errors.name)}
        </div>
        <div>
          <Label htmlFor="lead-company" className="mb-1.5 text-slate-300">{labels.company}</Label>
          <Input
            id="lead-company"
            autoComplete="organization"
            maxLength={120}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={labels.companyPlaceholder}
            aria-invalid={Boolean(errors.company)}
            className={cn(authInputClass, errors.company && 'border-red-500/50')}
          />
          {fieldError(errors.company)}
        </div>
      </div>

      <div>
        <Label htmlFor="lead-phone" className="mb-1.5 text-slate-300">{labels.phone}</Label>
        <PhoneInput
          key={resetKey}
          id="lead-phone"
          value={phoneValue}
          onChange={setPhoneValue}
          hasError={Boolean(errors.phone)}
          {...authPhoneInputClasses}
        />
        {fieldError(errors.phone)}
      </div>

      <div>
        <Label htmlFor="lead-comment" className="mb-1.5 text-slate-300">{labels.comment}</Label>
        <Textarea
          id="lead-comment"
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={labels.commentPlaceholder}
          className="min-h-24 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20 dark:bg-white/5"
        />
      </div>

      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {formError && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-7 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all duration-300 hover:scale-[1.01] hover:shadow-violet-500/60 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
      >
        {status === 'sending' ? (
          <>
            <CircleNotch weight="bold" className="h-4 w-4 animate-spin" />
            {labels.sending}
          </>
        ) : (
          <>
            <PaperPlaneTilt weight="fill" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            {labels.submit}
          </>
        )}
      </button>

      <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-sm text-slate-400">
        {labels.orCall}
        <a href={phone.href} className="inline-flex items-center gap-1.5 font-semibold text-white transition-colors hover:text-violet-300">
          <Phone weight="fill" className="h-4 w-4" />
          {phone.label}
        </a>
      </p>
    </form>
  )
}
