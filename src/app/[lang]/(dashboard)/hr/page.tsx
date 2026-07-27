import { redirect } from 'next/navigation'

export default async function HRRootPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/hr/employees`)
}
