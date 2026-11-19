'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavGroup, NavLink } from '@/components/layout/sidebar/nav-group'
import { activeSubKey, isActiveHref, NAV_ITEMS, visibleNavItems } from '@/components/layout/sidebar/nav-items'
import { BrandButton, SidebarAccount } from '@/components/layout/sidebar/sidebar-account'
import type { Profile } from '@/types/database.types'

interface AppSidebarProps {
  lang: string
  profile: Profile | null
}

/** Groups start open when the current page is one of theirs; in the collapsed rail a click re-opens the rail first. */
function useExpandedGroups(lang: string, pathname: string) {
  const { isMobile, state, setOpen } = useSidebar()
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_ITEMS.filter((item) => activeSubKey(item, pathname, lang)).map((item) => [item.key, true]))
  )
  const toggle = (key: string) => {
    if (!isMobile && state === 'collapsed') {
      setOpen(true)
      return setExpanded((current) => ({ ...current, [key]: true }))
    }
    setExpanded((current) => ({ ...current, [key]: !current[key] }))
  }
  return { expanded, toggle }
}

export function AppSidebar({ lang, profile }: AppSidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const groups = useExpandedGroups(lang, pathname)
  const closeOnMobile = () => isMobile && setOpenMobile(false)
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <BrandButton lang={lang} onNavigate={closeOnMobile} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {/* The primitive folds the label away with `-mt-8` in the rail, lifting the icons; keep the space, drop the text. */}
          <SidebarGroupLabel className="group-data-[collapsible=icon]:mt-0">{t('platform')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems(profile).map((item) =>
                item.subItems ? (
                  <NavGroup
                    key={item.key}
                    item={item}
                    lang={lang}
                    activeKey={activeSubKey(item, pathname, lang)}
                    expanded={!!groups.expanded[item.key]}
                    onToggle={() => groups.toggle(item.key)}
                    onNavigate={closeOnMobile}
                  />
                ) : (
                  <NavLink key={item.key} item={item} href={`/${lang}/${item.href}`} active={isActiveHref(pathname, lang, item.href)} onNavigate={closeOnMobile} />
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarAccount profile={profile} lang={lang} onNavigate={closeOnMobile} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
