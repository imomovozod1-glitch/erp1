'use client'

import { CheckCircle, CircleNotch, PaperPlaneTilt, Phone } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PhoneInput } from '@/components/ui/phone-input'
import { useLeadForm } from '@/components/landing/use-lead-form'
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
  consent: string
  required: string
}

// Light/dark pairs: the landing follows the app theme, unlike the always-dark
// sign-in cards these fields were first copied from.
const inputClass =
  'h-11 border-slate-900/10 bg-white/70 text-slate-900 placeholder:text-slate-400 focus-visible:border-violet-500 focus-visible:ring-violet-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500'
const labelClass = 'mb-1.5 text-slate-700 dark:text-slate-300'

/** The red star after a required field's label; the words are for screen readers. */
function Required({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden className="ml-0.5 text-rose-500">*</span>
      <span className="sr-only"> ({label})</span>
    </>
  )
}

/**
 * The landing page's sign-up request form. Text comes in as props because the
 * `landing` namespace is server-only (it is filtered out of the client
 * messages in src/app/[lang]/layout.tsx).
 *
 * Posts to /api/leads; the request is stored in `leads` and shows up in the
 * super-admin console under "Arizalar" (uz) / "Requests" (en).
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
  const { draft, set, errors, formError, status, resetKey, submit, reset } = useLeadForm(lang, labels)

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center py-10 text-center" role="status">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
          <CheckCircle weight="duotone" className="h-9 w-9" />
        </span>
        <h3 className="mt-5 text-2xl font-bold">{labels.successTitle}</h3>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{labels.successText}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 text-sm font-medium text-violet-600 underline-offset-4 transition-colors hover:text-violet-800 hover:underline dark:text-violet-300 dark:hover:text-white"
        >
          {labels.sendAnother}
        </button>
      </div>
    )
  }

  const fieldError = (message?: string) => message && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{message}</p>

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="lead-name" className={labelClass}>{labels.name}<Required label={labels.required} /></Label>
          <Input
            id="lead-name"
            autoComplete="name"
            maxLength={80}
            value={draft.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder={labels.namePlaceholder}
            required
            aria-invalid={Boolean(errors.name)}
            className={cn(inputClass, errors.name && 'border-red-500/50')}
          />
          {fieldError(errors.name)}
        </div>
        <div>
          <Label htmlFor="lead-company" className={labelClass}>{labels.company}<Required label={labels.required} /></Label>
          <Input
            id="lead-company"
            autoComplete="organization"
            maxLength={120}
            value={draft.company}
            onChange={(e) => set('company')(e.target.value)}
            placeholder={labels.companyPlaceholder}
            required
            aria-invalid={Boolean(errors.company)}
            className={cn(inputClass, errors.company && 'border-red-500/50')}
          />
          {fieldError(errors.company)}
        </div>
      </div>

      <div>
        <Label htmlFor="lead-phone" className={labelClass}>{labels.phone}<Required label={labels.required} /></Label>
        <PhoneInput
          key={resetKey}
          id="lead-phone"
          value={draft.phone}
          onChange={set('phone')}
          hasError={Boolean(errors.phone)}
          triggerClassName={cn(inputClass, '!h-11')}
          inputClassName={inputClass}
        />
        {fieldError(errors.phone)}
      </div>

      <div>
        <Label htmlFor="lead-comment" className={labelClass}>{labels.comment}</Label>
        <Textarea
          id="lead-comment"
          rows={3}
          maxLength={500}
          value={draft.comment}
          onChange={(e) => set('comment')(e.target.value)}
          placeholder={labels.commentPlaceholder}
          className={cn(inputClass, 'h-auto min-h-24')}
        />
      </div>

      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={draft.website} onChange={(e) => set('website')(e.target.value)} />
        </label>
      </div>

      {formError && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-100">
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

      <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">{labels.consent}</p>

      <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-sm text-slate-600 dark:text-slate-400">
        {labels.orCall}
        <a href={phone.href} className="inline-flex items-center gap-1.5 font-semibold text-slate-900 transition-colors hover:text-violet-600 dark:text-white dark:hover:text-violet-300">
          <Phone weight="fill" className="h-4 w-4" />
          {phone.label}
        </a>
      </p>
    </form>
  )
}
