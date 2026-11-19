'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import type { NavItem } from './nav-items'

/**
 * Modules read as headings (40px row, 15px semibold, 20px icon, kept in the icon rail so
 * nothing jumps on collapse); sub-items one step down at 14px on a 32px row — the size
 * is `!` because the primitive sets its own through a `data-[size=md]:` variant.
 */
export const TOP_LEVEL_BUTTON = 'h-10 min-h-10 text-[15px] font-semibold [&_svg]:size-5 group-data-[collapsible=icon]:p-1.5!'
const SUB_ITEM_BUTTON = 'h-8 min-h-8 text-[14px]! font-normal'

interface NavLinkProps {
  item: NavItem
  href: string
  active: boolean
  onNavigate: () => void
}

export function NavLink({ item, href, active, onNavigate }: NavLinkProps) {
  const t = useTranslations('nav')
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton render={<Link href={href} prefetch onClick={onNavigate} />} isActive={active} tooltip={t(item.key)} className={TOP_LEVEL_BUTTON}>
        <Icon />
        <span>{t(item.key)}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

interface NavGroupProps {
  item: NavItem
  lang: string
  activeKey: string | null
  expanded: boolean
  onToggle: () => void
  onNavigate: () => void
}

export function NavGroup({ item, lang, activeKey, expanded, onToggle, onNavigate }: NavGroupProps) {
  const t = useTranslations()
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={onToggle} isActive={activeKey !== null} tooltip={t(`nav.${item.key}`)} className={TOP_LEVEL_BUTTON}>
        <Icon />
        <span>{t(`nav.${item.key}`)}</span>
        {/* Hidden in the icon rail, where there is nothing to expand and it would overflow the 32px button. */}
        <ChevronRight className={cn('ml-auto size-4! transition-transform duration-200 group-data-[collapsible=icon]:hidden', expanded && 'rotate-90')} />
      </SidebarMenuButton>
      {expanded && (
        <SidebarMenuSub>
          {item.subItems?.map((sub) => (
            <SidebarMenuSubItem key={sub.key}>
              <SidebarMenuSubButton render={<Link href={`/${lang}/${sub.href}`} prefetch onClick={onNavigate} />} isActive={sub.key === activeKey} className={SUB_ITEM_BUTTON}>
                <span>{t(sub.label)}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}
