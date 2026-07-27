import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { DepartmentsTable } from '@/components/hr/departments-table'
import { getCachedDepartments } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Departments' }

export default async function DepartmentsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, departments] = await Promise.all([
    getTranslations('hr'),
    getCachedDepartments(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('departments')}
        subtitle={t('title')}
        action={{ label: t('addDepartment'), href: `/${lang}/hr/departments/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('departments') },
        ]}
      />
      <DepartmentsTable departments={departments} lang={lang} />
    </div>
  )
}
