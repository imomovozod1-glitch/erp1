'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/shared/page-header'
import { ContactCards } from '@/components/support/page/contact-cards'
import { SelfServiceLinks, SupportAside } from '@/components/support/page/support-aside'
import { TicketForm } from '@/components/support/page/ticket-form'
import { SupportConversation } from '@/components/support/support-conversation'

interface SupportClientProps {
  lang: string
  tenantId: string | null
  /** Server-rendered card naming the assigned support manager. */
  agentCard?: ReactNode
}

export function SupportClient({ lang, tenantId, agentCard }: SupportClientProps) {
  const t = useTranslations()
  // Bumped after a new ticket so the conversation list below pulls it in.
  const [threadsVersion, setThreadsVersion] = useState(0)
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('support.title')}
        subtitle={t('support.description')}
        info={t('pageInfo.support')}
        breadcrumbs={[{ label: 'Falco', href: `/${lang}/dashboard` }, { label: t('support.title') }]}
      />
      {agentCard}
      <ContactCards />
      <div className="grid gap-6 lg:grid-cols-5">
        <TicketForm onCreated={() => setThreadsVersion((v) => v + 1)} />
        <SupportAside />
      </div>
      {/* The company's own tickets — where the support agent's answer actually lands. */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t('supportChat.myTickets')}</h2>
        <SupportConversation endpoint="/api/tenant/support/threads" viewer="tenant" refreshKey={threadsVersion} inboxTopic={tenantId ? `support-inbox:tenant:${tenantId}` : undefined} />
      </section>
      <SelfServiceLinks lang={lang} />
    </div>
  )
}
