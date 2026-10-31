/**
 * The next automatic employee code: the tenant's highest purely numeric code
 * plus one, so a company's first employee is `1`. Codes that are not plain
 * numbers (the older generated `EMP-...` ones, or anything typed by hand) do
 * not take part in the count.
 */
export function nextEmployeeCode(codes: Iterable<string | null | undefined>): string {
  let highest = 0
  for (const code of codes) {
    // Past 15 digits a code stops being exact as a number; it is a label then.
    if (code && /^\d{1,15}$/.test(code)) highest = Math.max(highest, Number(code))
  }
  return String(highest + 1)
}
