'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function AdminLogoutButton({ label }: { label: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
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
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isLoading} className="gap-2">
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {label}
    </Button>
  )
}
