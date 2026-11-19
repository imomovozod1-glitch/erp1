'use client'

import Link from 'next/link'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface RowAction {
  key: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  href?: string
  disabled?: boolean
  destructive?: boolean
  hidden?: boolean
}

const DESTRUCTIVE = 'text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/30'

/** The trailing "⋯" menu of a list row; renders nothing when no action is available. */
export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const t = useTranslations('common')
  const visible = actions.filter((action) => !action.hidden)
  if (!visible.length) return null
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              aria-label={t('actions')}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent side="left">{t('actions')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        {visible.map(({ key, label, icon: Icon, onClick, href, disabled, destructive }) => (
          <DropdownMenuItem
            key={key}
            onClick={onClick}
            disabled={disabled}
            className={cn(destructive && DESTRUCTIVE)}
            render={href ? <Link href={href} prefetch /> : undefined}
          >
            <Icon className="mr-2 size-3.5" /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
