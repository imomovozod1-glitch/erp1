'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DeleteSupportAgentButton({ agentId }: { agentId: string }) {
  const t = useTranslations('admin.support.detail')
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(t('deleteConfirm'))) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/support-agents/${agentId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || 'Error')
        setIsDeleting(false)
        return
      }
      router.push('/admin/support')
      router.refresh()
    } catch {
      setIsDeleting(false)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleDelete} disabled={isDeleting} className="gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {t('deleteAgent')}
    </Button>
  )
}
