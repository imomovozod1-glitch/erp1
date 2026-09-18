import { requireModuleView } from '@/lib/permissions-server'

export default async function DistributionModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireModuleView('distribution', lang)
  return <>{children}</>
}
