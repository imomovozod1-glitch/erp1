'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { invalidateRoleTemplates } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { PermissionsMatrix } from '@/components/shared/permissions-matrix'
import { EMPTY_PERMISSIONS, type Permissions } from '@/lib/permissions'

interface RoleTemplateFormProps {
  initialData?: { id: string; name: string; permissions: unknown }
  lang: string
}

export function RoleTemplateForm({ initialData, lang }: RoleTemplateFormProps) {
  const t = useTranslations('hr')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any

  const [permsValue, setPermsValue] = useState<Permissions>(
    initialData?.permissions && typeof initialData.permissions === 'object'
      ? (initialData.permissions as Permissions)
      : EMPTY_PERMISSIONS
  )

  const formSchema = z.object({
    name: z.string().min(1, tCommon('required')),
  })
  type FormData = z.infer<typeof formSchema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: initialData?.name || '' },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const payload = { name: data.name, permissions: permsValue }
      if (initialData?.id) {
        const { error } = await supabase
          .from('role_templates')
          .update(payload)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('saved'))
      } else {
        const { error } = await supabase.from('role_templates').insert(payload)
        if (error) throw error
        toast.success(tCommon('created'))
      }
      await invalidateRoleTemplates()
      router.push(`/${lang}/hr/roles`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? tCommon('edit') : tCommon('add')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="name">{t('roleName')}</Label>
            <Input id="name" {...register('name')} placeholder={t('roleNamePlaceholder')} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>{tSettings('permissions')}</Label>
            <PermissionsMatrix value={permsValue} onChange={setPermsValue} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/${lang}/hr/roles`)}
              disabled={isSubmitting}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
