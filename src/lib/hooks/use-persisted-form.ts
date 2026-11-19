import { useForm, UseFormProps, UseFormReturn, FieldValues, DefaultValues } from 'react-hook-form'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// An abandoned draft must not keep overriding every later visit to the same form.
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

const storageKey = (formId: string) => `form_persist_${formId}`
const routeOf = (pathname: string) => pathname.replace(/^\/[a-z]{2}/, '')

interface Draft {
  path: string
  data: Record<string, unknown>
  savedAt: number
}

function readDraft(formId: string, path: string): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(storageKey(formId))
    const draft: Draft | null = raw ? JSON.parse(raw) : null
    if (!draft || draft.path !== path) return null
    if (typeof draft.savedAt === 'number' && Date.now() - draft.savedAt < DRAFT_MAX_AGE_MS) return draft.data
    sessionStorage.removeItem(storageKey(formId))
  } catch (e) {
    console.error('Error reading persisted form data', e)
  }
  return null
}

function writeDraft(formId: string, path: string, data: unknown) {
  try {
    sessionStorage.setItem(storageKey(formId), JSON.stringify({ path, data, savedAt: Date.now() }))
  } catch (e) {
    console.error('Error writing persisted form data', e)
  }
}

/**
 * `useForm` that keeps an unsaved edit in sessionStorage and offers it back on the
 * same edit route. A "new X" route always opens blank. The draft is restored after
 * hydration — reading it during render made the server and the browser disagree,
 * and React's recovery re-render could drop what the user had just typed.
 */
export function usePersistedForm<TFieldValues extends FieldValues = FieldValues, TContext = any>(
  formId: string,
  props?: UseFormProps<TFieldValues, TContext>
): UseFormReturn<TFieldValues, TContext> {
  const pathname = usePathname()
  const isCreateRoute = /\/new\/?$/.test(pathname)
  const form = useForm<TFieldValues, TContext>(props)
  const { reset } = form

  useEffect(() => {
    if (isCreateRoute) return
    const draft = readDraft(formId, routeOf(pathname))
    if (draft) reset({ ...props?.defaultValues, ...draft } as DefaultValues<TFieldValues>, { keepDefaultValues: true })
    // Restored once per form and route; later default changes belong to the form itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, pathname, isCreateRoute, reset])

  const { subscribe } = form
  useEffect(() => {
    if (isCreateRoute) return
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => writeDraft(formId, routeOf(pathname), values),
    })
  }, [subscribe, formId, pathname, isCreateRoute])

  return form
}

export function clearPersistedForm(formId: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(formId))
  } catch (e) {
    console.error('Error clearing persisted form data', e)
  }
}
