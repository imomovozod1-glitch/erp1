import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface PageInfoButtonProps {
  text: string
}

export function PageInfoButton({ text }: PageInfoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={text}
            className="inline-flex items-center justify-center h-5 w-5 rounded-full text-violet-500 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/50 transition-colors shrink-0"
          />
        }
      >
        <Info className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-sm leading-relaxed">
        {text}
      </PopoverContent>
    </Popover>
  )
}
