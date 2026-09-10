import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/admin-auth'
import { AuthScreen } from '@/components/auth/auth-card'

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Super-admin and tenant sessions share the same auth cookies — send a
    // signed-in super-admin to their own console, not the tenant dashboard.
    redirect((await isSuperAdmin(user.id)) ? '/admin/tenants' : `/${lang}/dashboard`)
  }

  return <AuthScreen>{children}</AuthScreen>
}
