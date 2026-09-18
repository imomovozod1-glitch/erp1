import { requireModuleView } from '@/lib/permissions-server'

export default async function ProductionModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireModuleView('production', lang)
  return <>{children}</>
}
