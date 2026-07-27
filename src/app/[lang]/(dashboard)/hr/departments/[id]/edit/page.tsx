import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { DepartmentForm } from '@/components/hr/department-form'
import { Metadata } from 'next'
import { getCachedDepartmentById } from '@/lib/data/queries'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const tCommon = await getTranslations({ locale: lang, namespace: 'common' })
  return { title: tCommon('edit') }
}

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ lang: string, id: string }>
}) {
  const { lang, id } = await params
  
  try {
    const department = await getCachedDepartmentById(id)
    if (!department) return notFound()

    const [t, tCommon] = await Promise.all([
      getTranslations('hr'),
      getTranslations('common'),
    ])

    return (
      <div className="space-y-6">
        <PageHeader
          title={tCommon('edit')}
          breadcrumbs={[
            { label: 'ERP', href: `/${lang}/dashboard` },
            { label: t('title'), href: `/${lang}/hr` },
            { label: t('departments'), href: `/${lang}/hr/departments` },
            { label: tCommon('edit') },
          ]}
        />
        <div className="px-4 md:px-8">
          <DepartmentForm lang={lang} initialData={department} />
        </div>
      </div>
    )
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return notFound()
  }
}
