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

/** Reads the first sheet of an uploaded .xlsx/.xls file into an array of row objects. */
export function readExcelFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
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
