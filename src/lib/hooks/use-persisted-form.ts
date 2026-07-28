import { useForm, UseFormProps, UseFormReturn, FieldValues, useWatch } from 'react-hook-form'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function usePersistedForm<TFieldValues extends FieldValues = FieldValues, TContext = any>(
  formId: string,
  props?: UseFormProps<TFieldValues, TContext>
): UseFormReturn<TFieldValues, TContext> {
  const pathname = usePathname()
  
  // 1. Get initial default values, checking sessionStorage
  const getInitialValues = () => {
    if (typeof window === 'undefined') return props?.defaultValues
    try {
      const savedStr = sessionStorage.getItem(`form_persist_${formId}`)
      if (savedStr) {
        const saved = JSON.parse(savedStr)
        const currentPath = pathname.replace(/^\/[a-z]{2}/, '')
        if (saved.path === currentPath) {
          return {
            ...props?.defaultValues,
            ...saved.data
          }
        }
      }
    } catch (e) {
      console.error('Error reading persisted form data', e)
    }
    return props?.defaultValues
  }

  const form = useForm<TFieldValues, TContext>({
    ...props,
    defaultValues: getInitialValues() as any
  })

  // 2. Watch all form changes and persist to sessionStorage (optimized with stringified values)
  const values = useWatch({ control: form.control })
  const valuesStr = JSON.stringify(values)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const currentPath = pathname.replace(/^\/[a-z]{2}/, '')
      sessionStorage.setItem(`form_persist_${formId}`, JSON.stringify({
        path: currentPath,
        data: values
      }))
    } catch (e) {
      console.error('Error writing persisted form data', e)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesStr, pathname, formId])

  return form
}

export function clearPersistedForm(formId: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(`form_persist_${formId}`)
  } catch (e) {
    console.error('Error clearing persisted form data', e)
  }
}
