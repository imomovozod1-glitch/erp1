'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface NamedOption {
  id: string
  name: string
}

interface NameSelectProps<T extends NamedOption> {
  id?: string
  value: string
  onChange: (id: string) => void
  options: readonly T[]
  placeholder: string
  meta?: (option: T) => ReactNode
  triggerClassName?: string
}

export function NameSelect<T extends NamedOption>({
  id,
  value,
  onChange,
  options,
  placeholder,
  meta,
  triggerClassName,
}: NameSelectProps<T>) {
  const tCommon = useTranslations('common')
  const selected = options.find((option) => option.id === value)
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? '')}>
      <SelectTrigger id={id} className={cn('w-full rounded-xl', triggerClassName)}>
        <SelectValue placeholder={placeholder}>{selected?.name ?? placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="rounded-xl p-1.5">
        {options.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">{tCommon('noData')}</p>
        ) : (
          options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="rounded-lg py-2 pr-8 pl-2.5">
              <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
                <span className="truncate font-medium">{option.name}</span>
                {meta?.(option)}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
