'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  AdminField,
  AdminFormActions,
  AdminFormSection,
  AdminFormShell,
} from '@/components/admin/admin-form-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminErrorMessage } from '@/lib/admin-errors'

/**
 * Super-admin → support-agent direct message.
 *
 * Creates a `kind='agent'` thread, which shows up in that agent's portal in
 * the same list as their tenant tickets (flagged as coming from the vendor),
 * so an agent has one place to look rather than two.
 */
export function MessageAgentForm({ agentId, agentName }: { agentId: string; agentName: string }) {
  const tErrors = useTranslations('admin.errors')
  const t = useTranslations('admin.support.message')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSend = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (isSending) return
    if (subject.trim().length < 3 || !body.trim()) {
      toast.error(t('messageRequired'))
      return
    }

    setIsSending(true)
    try {
      const res = await fetch('/api/admin/support/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, subject: subject.trim(), body: body.trim() }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(adminErrorMessage(tErrors, json, t('sendFailed')))
        return
      }
      toast.success(t('sent'))
      setSubject('')
      setBody('')
    } catch {
      toast.error(t('sendFailed'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AdminFormShell>
      <form onSubmit={handleSend}>
        <AdminFormSection
          icon={Send}
          title={t('title', { name: agentName })}
          description={t('hint')}
          columns={1}
        >
          <AdminField>
            <Label htmlFor="agent-msg-subject">{t('subject')}</Label>
            <Input
              id="agent-msg-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('subjectPlaceholder')}
            />
          </AdminField>
          <AdminField>
            <Label htmlFor="agent-msg-body">{t('body')}</Label>
            <Textarea
              id="agent-msg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder={t('bodyPlaceholder')}
            />
          </AdminField>
        </AdminFormSection>

        <AdminFormActions>
          <Button type="submit" disabled={isSending} className="bg-violet-600 hover:bg-violet-500">
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {t('send')}
          </Button>
        </AdminFormActions>
      </form>
    </AdminFormShell>
  )
}
