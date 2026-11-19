'use client'

import { useState, type FormEvent } from 'react'
import { CheckCircle2, MessageSquare, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LabeledField } from '@/components/shared/labeled-field'
import { errorMessage } from '@/lib/error-message'

const MIN_SUBJECT = 3

function Received({ onAgain }: { onAgain: () => void }) {
  const t = useTranslations('support')
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center animate-in duration-300 fade-in-50 zoom-in-95">
      <div className="mb-4 animate-bounce rounded-full bg-violet-50 p-4 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400">
        <CheckCircle2 className="size-10" />
      </div>
      <h3 className="text-lg font-bold text-foreground">{t('ticketReceived')}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('ticketSuccess')}</p>
      <Button onClick={onAgain} className="mt-6">
        {t('sendNewTicket')}
      </Button>
    </div>
  )
}

/** Opens a real thread that the company's support agent sees in their portal. */
export function TicketForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (subject.trim().length < MIN_SUBJECT || !message.trim()) return void toast.error(t('support.subjectMessageRequired'))
    setSubmitting(true)
    try {
      const res = await fetch('/api/tenant/support/threads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject.trim(), body: message.trim() }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '')
      setSent(true)
      toast.success(t('support.ticketSuccess'))
      setSubject('')
      setMessage('')
      onCreated()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="rounded-2xl border shadow-md lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="size-5 text-violet-600 dark:text-violet-400" />
          {t('support.submitTicket')}
        </CardTitle>
        <CardDescription>{t('support.ticketFormDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Received onAgain={() => setSent(false)} />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <LabeledField id="ticket-subject" label={t('support.ticketSubject')}>
              <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('support.subjectPlaceholder')} />
            </LabeledField>
            <LabeledField id="ticket-message" label={t('support.ticketMessage')}>
              <Textarea id="ticket-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('support.messagePlaceholder')} className="min-h-30" />
            </LabeledField>
            <Button type="submit" disabled={submitting} className="h-11 w-full gap-2 rounded-xl font-medium">
              <Send className="size-4" />
              {t(submitting ? 'support.sending' : 'support.submitTicket')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
