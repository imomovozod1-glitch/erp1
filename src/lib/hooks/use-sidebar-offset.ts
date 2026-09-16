'use client'

import { useSidebar } from '@/components/ui/sidebar'

/**
 * The left offset a `fixed` element needs to line up with the content card.
 *
 * Both sidebars in this app are `variant="inset"`, and that variant does not
 * collapse to `--sidebar-width-icon`: it collapses to that width **plus its own
 * 1rem of padding** (see the `sidebar-gap` element in ui/sidebar.tsx, which
 * resolves to `calc(var(--sidebar-width-icon) + --spacing(4))`). On top of
 * that, a collapsed inset sidebar gives `SidebarInset` an extra `ml-2` — so the
 * content card starts 0.5rem further right again. The whole page behind the
 * card is sidebar-coloured, so an offset that stops short of the card (the
 * header used to stop at icon + 1rem) reads as the header lying on top of the
 * sidebar whenever it is collapsed. Expanded, the inset has `ml-0` and the
 * sidebar width alone lines up.
 *
 * Three screens position themselves against the sidebar by hand, and the two
 * that got it wrong were copies of the one that got it right, so the value
 * lives here now rather than in three template literals.
 *
 * Returns Tailwind classes, including the `transition-[left]` that keeps the
 * element moving with the sidebar rather than jumping after it.
 */
export function useSidebarOffset(): string {
  const { state, isMobile } = useSidebar()

  // On mobile the sidebar is an overlay sheet — nothing to offset against.
  if (isMobile) return 'left-0 transition-[left] duration-200 ease-linear'

  return state === 'expanded'
    ? 'left-0 md:left-(--sidebar-width) transition-[left] duration-200 ease-linear'
    : 'left-0 md:left-[calc(var(--sidebar-width-icon)+1.5rem)] transition-[left] duration-200 ease-linear'
}
