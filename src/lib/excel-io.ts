import * as XLSX from 'xlsx'

export interface ExcelColumn {
  /** Column header shown in the exported/template file. */
  header: string
  /** Key used to read the value off a data row when exporting. */
  key: string
  /** Sample value shown in the downloadable template. */
  sample?: string | number
}

/** Exports a list of rows to an .xlsx file, one column per `columns` entry. */
export function exportRowsToExcel(rows: Record<string, any>[], columns: ExcelColumn[], filename: string, sheetName = 'Data') {
  const data = rows.map((row) => {
    const obj: Record<string, any> = {}
    columns.forEach((col) => {
      obj[col.header] = row[col.key] ?? ''
    })
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

/** Downloads a one-row sample .xlsx matching the headers `columns` import expects. */
export function downloadExcelTemplate(columns: ExcelColumn[], filename: string, sheetName = 'Shablon') {
  const sample: Record<string, any> = {}
  columns.forEach((col) => {
    sample[col.header] = col.sample ?? ''
  })
  const ws = XLSX.utils.json_to_sheet([sample])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024 // 5MB — import files are a few hundred rows at most

/**
 * Reads the first sheet of an uploaded .xlsx/.xls file into an array of row
 * objects.
 *
 * The `xlsx` package has known, unpatched prototype-pollution/ReDoS
 * advisories (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) with no fix on the
 * npm registry — SheetJS only publishes newer builds via their own CDN now.
 * Swapping the library is a bigger, riskier change across every import flow
 * in the app; until that's done, bound what reaches the parser: reject
 * anything not shaped like a spreadsheet file before it's ever parsed.
 */
export function readExcelFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      reject(new Error('Unsupported file type — expected .xlsx, .xls, or .csv'))
      return
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      reject(new Error('File is too large (max 5MB)'))
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsName = wb.SheetNames[0]
        const ws = wb.Sheets[wsName]
        resolve(XLSX.utils.sheet_to_json(ws))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsBinaryString(file)
  })
}

/** Reads a cell value by trying several possible header spellings (uz/ru/en), returns '' if none match. */
export function pickField(row: Record<string, any>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim()
    }
  }
  return ''
}
