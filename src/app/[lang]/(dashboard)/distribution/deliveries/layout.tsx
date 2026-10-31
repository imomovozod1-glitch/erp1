import { requireResourceView } from '@/lib/permissions-server'

export default async function DistributionDeliveriesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('distribution', 'deliveries', lang)
  return children
}
