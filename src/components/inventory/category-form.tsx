'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateCategories } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const baseSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
})

type FormData = z.infer<typeof baseSchema>

interface CategoryFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  lang: string
}

export function CategoryForm({ initialData, lang }: CategoryFormProps) {
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const formSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    slug: z.string().min(1, tCommon('required')),
    description: z.string().optional(),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      slug: initialData?.slug || '',
      description: initialData?.description || '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from('categories')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(data as any)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('success'))
      } else {
        // Create
        const { error } = await supabase
          .from('categories')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert([data as any])
        if (error) throw error
        toast.success(tCommon('success'))
      }
      await invalidateCategories()
      router.push(`/${lang}/inventory/categories`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="name">{tCommon('name')} *</Label>
        <Input id="name" {...register('name')} placeholder={tCommon('name')} />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">{t('slug')} *</Label>
        <Input id="slug" {...register('slug')} placeholder={t('slug')} />
        {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{tCommon('description')}</Label>
        <Textarea id="description" {...register('description')} placeholder={tCommon('description')} rows={4} />
        {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${lang}/inventory/categories`)}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
