'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Super-admin → support-agent direct message.
 *
 * Creates a `kind='agent'` thread, which shows up in that agent's portal in
 * the same list as their tenant tickets (flagged as coming from the vendor),
 * so an agent has one place to look rather than two.
 */
export function MessageAgentForm({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSending) return
    if (subject.trim().length < 3 || !body.trim()) {
      toast.error('Subject and message are required')
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
        throw new Error(json.error || 'Failed to send')
      }
      toast.success('Message sent')
      setSubject('')
      setBody('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Message {agentName}</CardTitle>
        <CardDescription>Sends a direct message into this agent&apos;s support portal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="agent-msg-subject">Subject</Label>
            <Input
              id="agent-msg-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. New tenant assigned"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agent-msg-body">Message</Label>
            <Textarea
              id="agent-msg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write your message…"
            />
          </div>
          <Button type="submit" disabled={isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
