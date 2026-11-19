'use client'

import { Building2, CalendarCheck, CalendarX, FileText, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileCard, ProfileLine } from '@/components/shared/profile-lines'
import { PERMISSION_ACTIONS } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'
import { grantedModules } from './employee-figures'

export function PersonnelCard({ employee }: { employee: any }) {
  const t = useTranslations()
  return (
    <ProfileCard title={t('hr.detail.personnelDetails')}>
      <ProfileLine icon={Phone} label={t('hr.phoneNumber')}>
        <span className="tabular-nums">{employee.profiles?.phone ?? '—'}</span>
      </ProfileLine>
      <ProfileLine icon={Building2} label={t('hr.department')}>{employee.profiles?.departments?.name ?? '—'}</ProfileLine>
      <ProfileLine icon={CalendarCheck} label={t('hr.hiredAt')}>{formatDate(employee.hired_at)}</ProfileLine>
      {!employee.is_active && employee.terminated_at && (
        <ProfileLine icon={CalendarX} label={t('hr.terminatedAt')}>
          <span className="text-rose-600 dark:text-rose-400">{formatDate(employee.terminated_at)}</span>
        </ProfileLine>
      )}
      {employee.notes && (
        <ProfileLine icon={FileText} label={t('common.description')}>
          <p className="text-xs leading-relaxed font-normal text-muted-foreground">{employee.notes}</p>
        </ProfileLine>
      )}
    </ProfileCard>
  )
}

function ModuleGrant({ module, perm }: ReturnType<typeof grantedModules>[number]) {
  const t = useTranslations()
  return (
    <div className="border-b pb-2.5 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{t(`nav.${module}`)}</span>
        {perm.scope === 'own' && <span className="text-[11px] text-amber-600 dark:text-amber-400">{t('permissions.scope_own')}</span>}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {PERMISSION_ACTIONS.filter((action) => perm[action]).map((action) => (
          <span key={action} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            {t(`permissions.action_${action}`)}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AccessCard({ profile }: { profile: any }) {
  const t = useTranslations()
  const modules = grantedModules(profile)
  const roleName = profile?.role_templates?.name ?? (profile?.role ? t(`settings.role.${profile.role}`) : '')
  return (
    <Card className="self-start border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-bold">{t('hr.roles')}</CardTitle>
        {profile && <p className="text-xs text-muted-foreground">{roleName}</p>}
      </CardHeader>
      <CardContent className="space-y-2.5 text-sm">
        {modules.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t(profile ? 'common.noData' : 'hr.systemAccessNone')}</p>
        ) : (
          modules.map((grant) => <ModuleGrant key={grant.module} {...grant} />)
        )}
      </CardContent>
    </Card>
  )
}
