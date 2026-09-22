'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/shared/confirm-dialog'

export function AdminLogoutButton({ label }: { label: string }) {
  const t = useTranslations('common')
  const [isLoading, setIsLoading] = useState(false)
  // Signing out throws away unsaved work on the page behind it and costs a
  // full sign-in to undo, so it asks first — the same dialog every delete in
  // the app goes through.
  const [confirm, confirmDialog] = useConfirm()

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: t('confirmLogoutTitle'),
      description: t('confirmLogoutDescription'),
      confirmLabel: label,
      confirmIcon: LogOut,
    })
    if (!confirmed) return
    setIsLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // A full page load rather than router.push + router.refresh: the refresh
    // re-rendered the page being left (on the dashboard, every stats query)
    // before the login page could show, and with `staleTimes` the client
    // router could still serve cached signed-in pages afterwards.
    window.location.replace('/admin/login')
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isLoading} className="gap-2">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {label}
      </Button>
      {confirmDialog}
    </>
  )
}
