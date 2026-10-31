import { requireResourceView } from '@/lib/permissions-server'

export default async function CustomersCategoriesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('customers', 'categories', lang)
  return children
}
