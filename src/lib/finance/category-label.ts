/** Takes the `finance` namespace translator. */
type Translate = (key: 'categorySales') => string

/** Categories the system writes itself ('Sales' from a sale, 'sales' from an invoice payment) read as a word, not a code. */
const SYSTEM_CATEGORIES: Record<string, 'categorySales'> = { sales: 'categorySales' }

export const categoryLabel = (t: Translate, category: string | null | undefined) => {
  if (!category) return ''
  const key = SYSTEM_CATEGORIES[category.toLowerCase()]
  return key ? t(key) : category
}
