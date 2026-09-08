'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

/** Mirrors `allowed_mime_types` on the bucket (supabase/migration_product_images.sql). */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
/** Mirrors the bucket's `file_size_limit`; checked here too so the user gets a
 *  readable message instead of a raw storage error after a pointless upload. */
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Single-image picker backed by Supabase Storage.
 *
 * Uploads straight from the browser with the user's own session — the same
 * direct-from-the-client pattern every write in this app uses — and hands the
 * resulting public URL back through `onChange` so the caller just stores it in
 * a plain `image_url` column.
 *
 * Objects are written as `<tenant_id>/<uuid>.<ext>`; the tenant prefix is what
 * the bucket's RLS policies check, so it is read from the caller's own profile
 * rather than passed in (a client-supplied tenant id would be worthless as a
 * boundary anyway).
 */
export function ImageUpload({
  value,
  onChange,
  bucket = 'product-images',
  label,
  disabled,
}: {
  value: string | null
  onChange: (url: string | null) => void
  bucket?: string
  label?: string
  disabled?: boolean
}) {
  const t = useTranslations('common')
  const supabase = createClient() as any
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  /** Storage path of a public URL from this bucket, or null if it points elsewhere. */
  const pathFromPublicUrl = (url: string): string | null => {
    const marker = `/storage/v1/object/public/${bucket}/`
    const at = url.indexOf(marker)
    return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length))
  }

  const removeStoredObject = async (url: string | null) => {
    if (!url) return
    const path = pathFromPublicUrl(url)
    if (!path) return
    // Best-effort: a failed cleanup leaves an orphaned file, which is far less
    // bad than blocking the user's edit on it.
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) console.warn('Failed to remove image object:', error.message)
  }

  const handleFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t('imageTypeInvalid'))
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('imageTooLarge'))
      return
    }

    setIsUploading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) throw new Error(t('sessionNotFound'))

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userId)
        .single()
      if (profileErr) throw profileErr

      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${profile.tenant_id}/${crypto.randomUUID()}.${extension}`

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (uploadErr) throw uploadErr

      const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path)

      // Only drop the previous file once the new one is safely stored.
      const previous = value
      onChange(publicUrl.publicUrl)
      await removeStoredObject(previous)
    } catch (error: any) {
      toast.error(error.message || t('error'))
    } finally {
      setIsUploading(false)
      // Let the same file be picked again after a failure/removal.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    const previous = value
    onChange(null)
    await removeStoredObject(previous)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <Label>{label ?? t('image')}</Label>
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 transition-colors hover:border-violet-400 hover:text-violet-500 disabled:opacity-60"
        >
          {value ? (
            <Image
              src={value}
              alt={label ?? t('image')}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1">
              <ImagePlus className="h-6 w-6" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {t('image')}
              </span>
            </span>
          )}
          {isUploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70">
              <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
            </span>
          )}
        </button>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? t('uploadingImage') : value ? t('changeImage') : t('uploadImage')}
            </Button>
            {value && !isUploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={handleRemove}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t('removeImage')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('imageHint')}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
