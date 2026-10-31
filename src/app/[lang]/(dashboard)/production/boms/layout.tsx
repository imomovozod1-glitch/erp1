import { requireResourceView } from '@/lib/permissions-server'

export default async function ProductionBomsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('production', 'boms', lang)
  return children
}
