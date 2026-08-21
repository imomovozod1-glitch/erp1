'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, getInitials } from '@/lib/utils'

export interface SuperAdminRow {
  id: string
  full_name: string
  email: string
  created_at: string
}

export function SuperAdminsTable({
  admins,
  currentAdminId,
}: {
  admins: SuperAdminRow[]
  currentAdminId: string
}) {
  const t = useTranslations('admin.settings.admins')
  const tPassword = useTranslations('admin.password')
  const router = useRouter()

  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || password.length < 6) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || t('error'))
        return
      }
      toast.success(t('created'))
      setFullName('')
      setEmail('')
      setPassword('')
      setShowForm(false)
      router.refresh()
    } catch {
      toast.error(t('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('confirmDelete', { name }))) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || t('error'))
        return
      }
      toast.success(t('deleted'))
      router.refresh()
    } catch {
      toast.error(t('error'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-3xl">
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t('count', { count: admins.length })}</p>
          <Button onClick={() => setShowForm((v) => !v)} variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> {t('addAdmin')}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border p-4 dark:border-slate-800">
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-name">{t('fullName')}</Label>
              <Input id="new-admin-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-email">{t('email')}</Label>
              <Input id="new-admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-password">{t('password')}</Label>
              <PasswordInput
                id="new-admin-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                showLabel={tPassword('show')}
                hideLabel={tPassword('hide')}
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('create')}
              </Button>
            </div>
          </form>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colName')}</TableHead>
              <TableHead>{t('colEmail')}</TableHead>
              <TableHead>{t('colSince')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                      {getInitials(admin.full_name)}
                    </div>
                    {admin.full_name}
                    {admin.id === currentAdminId && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                        <ShieldCheck className="h-2.5 w-2.5" /> {t('you')}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-slate-500">{admin.email}</TableCell>
                <TableCell className="text-slate-500">{formatDate(admin.created_at)}</TableCell>
                <TableCell>
                  {admin.id !== currentAdminId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingId === admin.id}
                      onClick={() => handleDelete(admin.id, admin.full_name)}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                    >
                      {deletingId === admin.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
