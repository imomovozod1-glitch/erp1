import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { EmployeeForm } from '@/components/hr/employee-form'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'hr' })
  return { title: t('addEmployee') }
}

export default async function NewEmployeePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const [t, tCommon] = await Promise.all([
    getTranslations('hr'),
    getTranslations('common'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addEmployee')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/hr` },
          { label: t('employees'), href: `/${lang}/hr/employees` },
          { label: tCommon('add') },
        ]}
      />
      <div className="px-4 md:px-8">
        <EmployeeForm lang={lang} />
      </div>
    </div>
  )
}
