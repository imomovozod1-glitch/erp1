'use client'

import { useTranslations } from 'next-intl'
import { UserCheck } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface AssignableUser {
  id: string
  full_name: string | null
  role?: string
}

/**
 * "Responsible person" picker for documents.
 *
 * Separate from the creator on purpose: `created_by` records who entered the
 * document, `assigned_to` records whose work it is. They differ often enough
 * that conflating them broke the `own` data scope — a salesperson saw the
 * orders they had typed rather than the orders they own.
 *
 * Defaults to the current user when nothing is chosen, so a document is never
 * left unassigned by accident (an unassigned document is invisible to everyone
 * whose scope is `own`).
 */
export function AssigneeSelect({
  value,
  onChange,
  users,
  currentUserId,
  disabled,
}: {
  value: string | null
  onChange: (next: string | null) => void
  users: AssignableUser[]
  currentUserId?: string | null
  disabled?: boolean
}) {
  const t = useTranslations('common')
  const selected = value ?? currentUserId ?? null
  const label = (id: string | null) =>
    users.find((u) => u.id === id)?.full_name || t('unassigned')

  return (
    <div className="space-y-2">
      <Label htmlFor="assigned_to" className="flex items-center gap-1.5">
        <UserCheck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        {t('assignedTo')}
      </Label>
      <Select
        value={selected ?? 'none'}
        onValueChange={(v) => onChange(v === 'none' ? null : v)}
      >
        <SelectTrigger id="assigned_to" className="w-full" disabled={disabled}>
          <SelectValue>{selected ? label(selected) : t('unassigned')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('unassigned')}</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.full_name || user.id.slice(0, 8)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('assignedToHint')}</p>
    </div>
  )
}
