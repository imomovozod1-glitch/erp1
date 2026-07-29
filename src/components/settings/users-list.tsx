'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { invalidateProfile } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Search, UserCheck, Shield, Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import type { Profile } from '@/types/database.types'

interface UsersListProps {
  profiles: Profile[]
  currentUserProfile: Profile | null
}

export function UsersList({ profiles: initialProfiles, currentUserProfile }: UsersListProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
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

  // Filter profiles based on search term
  const filteredProfiles = profiles.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Count summaries
  const totalCount = profiles.length
  const activeCount = profiles.filter((p) => p.is_active).length
  const adminCount = profiles.filter((p) => p.role === 'admin').length

  const roleBadgeStyles: Record<string, string> = {
    admin: 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50',
    manager: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50',
    staff: 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-50',
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
        <Card className="border-slate-200/60 shadow-sm flex items-center p-6 gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('users')}</p>
            <p className="text-2xl font-bold text-slate-800">{totalCount}</p>
          </div>
        </Card>

        <Card className="border-slate-200/60 shadow-sm flex items-center p-6 gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{tCommon('status') || 'Active'}</p>
            <p className="text-2xl font-bold text-slate-800">{activeCount}</p>
          </div>
        </Card>

        <Card className="border-slate-200/60 shadow-sm flex items-center p-6 gap-4">
          <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('role.admin')}</p>
            <p className="text-2xl font-bold text-slate-800">{adminCount}</p>
          </div>
        </Card>
      </div>

      {/* Main List */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800">{t('users')}</CardTitle>
            <CardDescription>
              {isAdmin
                ? t('roles') || 'Manage employee roles and permissions'
                : 'View directory of active workspace users'}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={tCommon('search') || 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-slate-200 focus-visible:ring-indigo-500"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[280px] font-semibold text-slate-600">User</TableHead>
                  <TableHead className="font-semibold text-slate-600">Email</TableHead>
                  <TableHead className="font-semibold text-slate-600">Role</TableHead>
                  <TableHead className="w-[120px] font-semibold text-slate-600">Status</TableHead>
                  {isAdmin && <TableHead className="w-[140px] font-semibold text-slate-600 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center text-slate-400">
                      No results found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProfiles.map((p) => {
                    const initials = p.full_name
                      ?.split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() ?? 'U'

                    const isSelf = p.id === currentUserProfile?.id

                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/30 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">
                                {p.full_name}
                                {isSelf && (
                                  <Badge className="ml-2 bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] font-medium py-0 px-1.5">
                                    You
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 font-normal capitalize">
                                {p.phone || 'No phone'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm">{p.email}</TableCell>
                        <TableCell>
                          {isAdmin && !isSelf ? (
                            <Select
                              value={p.role}
                              disabled={updatingUserId === p.id}
                              onValueChange={(val) => {
                                if (val) handleRoleChange(p.id, val as any)
                              }}
                            >
                              <SelectTrigger className="w-36 border-slate-200 text-sm font-medium">
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
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50'
                                : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50'
                            }`}
                          >
                            {p.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {isSelf ? (
                              <span className="text-xs text-slate-400 font-normal italic">Self-management disabled</span>
                            ) : (
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  type="button"
                                  disabled={updatingUserId === p.id}
                                  onClick={() => handleStatusChange(p.id, p.is_active)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    p.is_active ? 'bg-indigo-600' : 'bg-slate-200'
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
          </div>
        </CardContent>
      </Card>

      {/* Info Card on Registration */}
      <Card className="border-slate-100 bg-slate-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 bg-white rounded border border-slate-100 text-indigo-600 mt-0.5">
            <Shield className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">Account Registration Security</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              For security, users must register accounts individually via signup. Once registered, administrators can manage access permissions, roles, and status levels in the table above.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
