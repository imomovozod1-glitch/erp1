'use client'

import { useIsRouteModal } from '@/lib/hooks/use-route-modal'
import { cn } from '@/lib/utils'

/**
 * The Cancel / Save row at the end of a form (AGENTS.md § 3a).
 *
 * Desktop: the plain right-aligned row with a top border. Phones: a glass
 * action bar pinned above the bottom nav so Save is always in reach, buttons
 * sharing the width. Inside the route modal (a bottom sheet with no nav) it
 * pins to the sheet's own bottom edge instead.
 */
export function FormFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const inModal = useIsRouteModal()
  return (
    <div
      className={cn(
        'flex justify-end gap-2 border-t pt-4',
        'max-md:sticky max-md:z-20 max-md:rounded-2xl max-md:border max-md:bg-background/90 max-md:p-2.5 max-md:shadow-lg max-md:backdrop-blur',
        'max-md:[&>*]:flex-1',
        inModal
          ? 'max-md:bottom-0'
          : 'max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]',
        className
      )}
    >
      {children}
    </div>
  )
}
