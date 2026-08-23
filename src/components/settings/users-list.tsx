'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { invalidateProfile } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Search, UserCheck, Shield, Users, KeyRound, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getInitials } from '@/lib/utils'
import { isStrongPassword } from '@/lib/password-validation'
import type { Profile } from '@/types/database.types'

interface UsersListProps {
  profiles: Profile[]
  currentUserProfile: Profile | null
  lang: string
}

export function UsersList({ profiles: initialProfiles, currentUserProfile, lang }: UsersListProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [search, setSearch] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [resetTarget, setResetTarget] = useState<{ id: string; name: string | null } | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])
  const supabase = createClient() as any

  const isAdmin = currentUserProfile?.role === 'admin'

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'manager' | 'staff') => {
    setUpdatingUserId(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      )
      await invalidateProfile(userId)
      toast.success(tCommon('success'))
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleStatusChange = async (userId: string, currentStatus: boolean) => {
    setUpdatingUserId(userId)
    const newStatus = !currentStatus
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', userId)

      if (error) throw error

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, is_active: newStatus } : p))
      )
      await invalidateProfile(userId)
      toast.success(tCommon('success'))
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleResetPassword = async () => {
    if (!resetTarget || !isStrongPassword(resetPassword)) return
    setIsResetting(true)
    try {
      const res = await fetch(`/api/tenant/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || t('resetUserPasswordError'))
        return
      }
      toast.success(t('resetUserPasswordSuccess'))
      setResetTarget(null)
      setResetPassword('')
    } catch {
      toast.error(t('resetUserPasswordError'))
    } finally {
      setIsResetting(false)
    }
  }

  // Filter profiles based on search term
  const filteredProfiles = profiles.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filteredProfiles.length / itemsPerPage)
  const paginated = filteredProfiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Count summaries
  const totalCount = profiles.length
  const activeCount = profiles.filter((p) => p.is_active).length
  const adminCount = profiles.filter((p) => p.role === 'admin').length

  const roleBadgeStyles: Record<string, string> = {
    admin: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40',
    manager: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/40',
    staff: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
  }

  const roleLabels: Record<string, string> = {
    admin: t('role.admin'),
    manager: t('role.manager'),
    staff: t('role.staff'),
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center p-6 gap-4">
          <div className="p-3 bg-violet-50 dark:bg-violet-950/40 rounded-xl text-violet-600 dark:text-violet-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('users')}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{totalCount}</p>
          </div>
        </Card>

        <Card className="border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center p-6 gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tCommon('active')}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{activeCount}</p>
          </div>
        </Card>

        <Card className="border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center p-6 gap-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-600 dark:text-rose-400">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('role.admin')}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{adminCount}</p>
          </div>
        </Card>
      </div>

      {/* Main List */}
      <Card className="border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">{t('users')}</CardTitle>
            <CardDescription>
              {isAdmin
                ? (t('roles') || (lang === 'uz' ? 'Xodimlar rollari va ruxsatlarini boshqarish' : lang === 'ru' ? 'Управление ролями и правами сотрудников' : 'Manage employee roles and permissions'))
                : (lang === 'uz' ? 'Faol foydalanuvchilar ro\'yxatini ko\'ring' : lang === 'ru' ? 'Просмотр списка активных пользователей' : 'View directory of active workspace users')}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={tCommon('search') || 'Search...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="w-10 text-center font-semibold text-slate-600 dark:text-slate-400">#</TableHead>
                  <TableHead className="w-[280px] font-semibold text-slate-600 dark:text-slate-400">{t('users')}</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">{tCommon('email')}</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">{lang === 'uz' ? 'Rol' : lang === 'ru' ? 'Роль' : 'Role'}</TableHead>
                  <TableHead className="w-[120px] font-semibold text-slate-600 dark:text-slate-400">{tCommon('status')}</TableHead>
                  {isAdmin && <TableHead className="w-[140px] font-semibold text-slate-600 dark:text-slate-400 text-right">{tCommon('actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center text-slate-400 dark:text-slate-500">
                      {tCommon('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((p, index) => {
                    const initials = getInitials(p.full_name) || 'U'

                    const isSelf = p.id === currentUserProfile?.id

                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-xs font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {p.full_name}
                                {isSelf && (
                                  <Badge className="ml-2 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-900/50 text-[10px] font-medium py-0 px-1.5">
                                    {lang === 'uz' ? 'Siz' : lang === 'ru' ? 'Вы' : 'You'}
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal capitalize">
                                {p.phone || (lang === 'uz' ? 'Telefon yo\'q' : lang === 'ru' ? 'Нет телефона' : 'No phone')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 text-sm">{p.email}</TableCell>
                        <TableCell>
                          {isAdmin && !isSelf ? (
                            <Select
                              value={p.role}
                              disabled={updatingUserId === p.id}
                              onValueChange={(val) => {
                                if (val) handleRoleChange(p.id, val as any)
                              }}
                            >
                              <SelectTrigger className="w-36 border-slate-200 dark:border-slate-700 text-sm font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">{t('role.admin')}</SelectItem>
                                <SelectItem value="manager">{t('role.manager')}</SelectItem>
                                <SelectItem value="staff">{t('role.staff')}</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={`${roleBadgeStyles[p.role]} text-xs font-medium px-2 py-0.5 border`}>
                              {roleLabels[p.role] || p.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold px-2.5 py-0.5 border ${
                              p.is_active
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            }`}
                          >
                            {p.is_active ? tCommon('active') : tCommon('inactive')}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {isSelf ? (
                              <span className="text-xs text-slate-400 dark:text-slate-500 font-normal italic">{lang === 'uz' ? "O'zini boshqarish o'chirilgan" : lang === 'ru' ? 'Самоуправление отключено' : 'Self-management disabled'}</span>
                            ) : (
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  type="button"
                                  title={t('resetUserPassword')}
                                  onClick={() => { setResetTarget({ id: p.id, name: p.full_name }); setResetPassword('') }}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingUserId === p.id}
                                  onClick={() => handleStatusChange(p.id, p.is_active)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    p.is_active ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      p.is_active ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="cursor-pointer"
                >
                  {lang === 'uz' ? 'Orqaga' : lang === 'ru' ? 'Назад' : 'Previous'}
                </Button>
                <span className="text-xs text-muted-foreground font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="cursor-pointer"
                >
                  {lang === 'uz' ? 'Oldinga' : lang === 'ru' ? 'Вперед' : 'Next'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card on Registration */}
      <Card className="border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 text-violet-600 dark:text-violet-400 mt-0.5">
            <Shield className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {lang === 'uz' ? "Ro'yxatdan o'tish xavfsizligi" : lang === 'ru' ? 'Безопасность регистрации' : 'Account Registration Security'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {lang === 'uz'
                ? "Xavfsizlik uchun foydalanuvchilar ro'yxatdan alohida o'tishlari kerak. Ro'yxatdan o'tgandan so'ng, administratorlar yuqoridagi jadvalda ruxsatlar, rollar va holatlarni boshqarishlari mumkin."
                : lang === 'ru'
                ? 'В целях безопасности пользователи должны регистрироваться самостоятельно. После регистрации администраторы могут управлять правами доступа, ролями и статусами в таблице выше.'
                : 'For security, users must register accounts individually via signup. Once registered, administrators can manage access permissions, roles, and status levels in the table above.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setResetPassword('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('resetUserPasswordDialogTitle', { name: resetTarget?.name || '' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reset-user-password">{tAuth('password')}</Label>
            <PasswordInput
              id="reset-user-password"
              placeholder="••••••••"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              showLabel={tAuth('showPassword')}
              hideLabel={tAuth('hidePassword')}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">{tAuth('passwordRequirements')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetPassword('') }}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={isResetting || !isStrongPassword(resetPassword)}
              className="bg-violet-600 hover:bg-violet-700 gap-2 disabled:cursor-not-allowed"
            >
              {isResetting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('resetUserPassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
