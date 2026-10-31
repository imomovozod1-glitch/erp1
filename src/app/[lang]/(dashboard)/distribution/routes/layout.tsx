import { requireResourceView } from '@/lib/permissions-server'

export default async function DistributionRoutesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('distribution', 'routes', lang)
  return children
}
