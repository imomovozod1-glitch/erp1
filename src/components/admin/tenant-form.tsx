'use client'

import { useState } from 'react'
import { FileText, LifeBuoy, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NameSelect } from '@/components/shared/name-select'
import { AdminField, AdminFormActions, AdminFormSection, AdminFormShell } from '@/components/admin/admin-form-layout'
import { TenantPaymentDialog } from '@/components/admin/tenant-payment-dialog'
import { BasicsSection, CreateSubscription, EditSubscription } from '@/components/admin/tenant-form/tenant-sections'
import type { SupportAgentOption, TenantFormInitialData, TenantFormMode } from '@/components/admin/tenant-form/tenant-schema'
import { useTenantForm, type TenantFormState } from '@/components/admin/tenant-form/use-tenant-form'

export type { SupportAgentOption, TenantFormInitialData } from '@/components/admin/tenant-form/tenant-schema'

interface TenantFormProps {
  mode: TenantFormMode
  initialData?: TenantFormInitialData
  supportAgents: SupportAgentOption[]
}

function SupportAndNotes({ state, agents }: { state: TenantFormState; agents: SupportAgentOption[] }) {
  const t = useTranslations('admin.form')
  const options = agents.map((a) => ({ id: a.id, name: a.full_name }))
  return (
    <>
      <AdminFormSection icon={LifeBuoy} title={t('sectionSupport')} description={t('sectionSupportHint')} columns={1}>
        <AdminField className="sm:w-80">
          <Controller
            control={state.form.control}
            name="support_agent_id"
            render={({ field }) => (
              <NameSelect value={field.value ?? ''} onChange={(id) => field.onChange(id || null)} options={options} placeholder={t('noSupportAgent')} clearLabel={t('noSupportAgent')} />
            )}
          />
        </AdminField>
      </AdminFormSection>
      <AdminFormSection icon={FileText} title={t('sectionNotes')} description={t('sectionNotesHint')} columns={1}>
        <AdminField>
          <Textarea id="details" rows={4} placeholder={t('detailsPlaceholder')} {...state.form.register('details')} />
        </AdminField>
      </AdminFormSection>
    </>
  )
}

/** A company's identity, subscription (create only), support agent and notes. */
export function TenantForm({ mode, initialData, supportAgents }: TenantFormProps) {
  const t = useTranslations('admin.form')
  const state = useTenantForm(mode, initialData)
  const [paying, setPaying] = useState(false)
  const editing = mode === 'edit' && initialData
  return (
    <AdminFormShell>
      <form onSubmit={state.onSubmit}>
        <BasicsSection state={state} create={mode === 'create'} />
        {editing ? <EditSubscription initial={initialData} onPay={() => setPaying(true)} /> : <CreateSubscription state={state} />}
        <SupportAndNotes state={state} agents={supportAgents} />
        <AdminFormActions>
          <Button type="button" variant="outline" onClick={() => state.exitForm()}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={state.submitting}>
            {state.submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t(mode === 'create' ? 'create' : 'save')}
          </Button>
        </AdminFormActions>
      </form>
      {editing && <TenantPaymentDialog tenant={initialData} open={paying} onOpenChange={setPaying} />}
    </AdminFormShell>
  )
}
