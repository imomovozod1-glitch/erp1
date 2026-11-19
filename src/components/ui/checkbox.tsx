"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The one checkbox of the app. Checked and partly-checked (`indeterminate`)
 * both fill with the brand violet (`primary`), so a group that is only partly
 * granted still reads as "on, but not all" rather than as off. `size="lg"` is
 * the larger box for rows that are the main thing on screen (a permissions
 * section); the default stays the compact one forms already use.
 */
function Checkbox({
  className,
  size = "default",
  ...props
}: CheckboxPrimitive.Root.Props & { size?: "default" | "lg" }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group/checkbox relative flex shrink-0 cursor-pointer items-center justify-center border border-muted-foreground/40 bg-card transition-all duration-150 outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-violet-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:hover:border-violet-500 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        "data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:data-indeterminate:bg-primary",
        size === "lg" ? "size-5 rounded-[6px]" : "size-4 rounded-[4px]",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={cn(
          "grid place-content-center text-current transition-none",
          size === "lg" ? "[&>svg]:size-4" : "[&>svg]:size-3.5"
        )}
      >
        {props.indeterminate ? <MinusIcon strokeWidth={3} /> : <CheckIcon strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
