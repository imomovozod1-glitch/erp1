'use client'

import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-slate-200 p-0.5 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 dark:bg-slate-700',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 data-[checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
