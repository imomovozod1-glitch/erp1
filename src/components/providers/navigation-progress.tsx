'use client'

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar'

/**
 * Shows a slim progress bar at the top of the page on every navigation.
 * This gives instant visual feedback when a link/button is clicked,
 * making the app feel as responsive as a React SPA even during SSR.
 */
export function NavigationProgress() {
  return (
    <ProgressBar
      height="3px"
      color="#6366f1"
      options={{ showSpinner: false, easing: 'ease', speed: 200 }}
      shallowRouting
    />
  )
}
