/**
 * Minimal ESC/POS command builder — targets the command subset that's
 * consistent across virtually every thermal receipt printer sold under the
 * "ESC/POS compatible" label (Xprinter, Epson TM-T, Rongta, Gprinter, etc.):
 * init, align, bold, double-size text, feed, partial cut, and the standard
 * cash-drawer kick pulse. No printer-specific extensions.
 */

const ESC = 0x1b
const GS = 0x1d

// CP866 (a common Cyrillic codepage on ESC/POS firmware) covers А-я + Ё/ё at
// 0x80-0xFF. Printer firmware varies on which codepage table number selects
// CP866 (see PrinterSettings.codepage) — 17 is the most common default across
// Xprinter/Gprinter/Rongta clones, but isn't a universal standard.
const CP866_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  const upper = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
  const lower = 'абвгдежзийклмнопрстуфхцчшщъыьэюя'
  for (let i = 0; i < upper.length; i++) map[upper[i]] = 0x80 + i
  for (let i = 0; i < lower.length; i++) map[lower[i]] = 0xa0 + i
  map['Ё'] = 0xf0
  map['ё'] = 0xf1
  return map
})()

// Uzbek Latin orthography's ʻ (U+02BB) / ʼ (U+02BC) and curly quotes are all
// outside ASCII and outside CP866 — none of them render on ESC/POS firmware,
// but a plain apostrophe is visually indistinguishable on a receipt printout
// and every printer supports it, so normalize rather than falling back to '?'.
const ASCII_APOSTROPHE_EQUIVALENTS = /[ʻʼ‘’]/g

function encodeText(text: string, cyrillic: boolean): number[] {
  const normalized = text.replace(ASCII_APOSTROPHE_EQUIVALENTS, "'")
  const bytes: number[] = []
  for (const ch of normalized) {
    const code = ch.codePointAt(0) ?? 63
    if (code < 128) {
      bytes.push(code)
    } else if (cyrillic && CP866_MAP[ch] !== undefined) {
      bytes.push(CP866_MAP[ch])
    } else {
      bytes.push(0x3f) // '?' fallback for anything the printer's codepage can't render
    }
  }
  return bytes
}

export type Align = 'left' | 'center' | 'right'

export class EscPosBuilder {
  private bytes: number[] = []
  private readonly cols: number
  /** Cyrillic text is transliterated through CP866 — set false for uz/en-only receipts to skip the lookup. */
  private readonly cyrillic: boolean
  private readonly codepage: number

  constructor(opts: { columns: number; cyrillic?: boolean; codepage?: number }) {
    this.cols = opts.columns
    this.cyrillic = opts.cyrillic ?? false
    this.codepage = opts.codepage ?? 17
    this.bytes.push(ESC, 0x40) // ESC @ — initialize
    if (this.cyrillic) {
      this.bytes.push(ESC, 0x74, this.codepage) // ESC t n — select character codepage
    }
  }

  align(a: Align): this {
    this.bytes.push(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2)
    return this
  }

  bold(on: boolean): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0)
    return this
  }

  /** width/height: 1 = normal, 2 = double */
  size(width: 1 | 2, height: 1 | 2): this {
    const n = ((width - 1) << 4) | (height - 1)
    this.bytes.push(GS, 0x21, n)
    return this
  }

  text(str: string): this {
    this.bytes.push(...encodeText(str, this.cyrillic))
    return this
  }

  line(str = ''): this {
    this.text(str)
    this.bytes.push(0x0a)
    return this
  }

  /** Two columns on one line — left-aligned label, right-aligned value, padded/truncated to the paper width. */
  row(left: string, right: string): this {
    const maxLeft = Math.max(0, this.cols - right.length - 1)
    const l = left.length > maxLeft ? left.slice(0, Math.max(0, maxLeft - 1)) + '…' : left
    const pad = Math.max(1, this.cols - l.length - right.length)
    return this.line(l + ' '.repeat(pad) + right)
  }

  hr(char = '-'): this {
    return this.line(char.repeat(this.cols))
  }

  feed(lines = 1): this {
    this.bytes.push(ESC, 0x64, lines)
    return this
  }

  /** Partial cut, leaving a tear strip — the standard for receipt printers (vs. GS V 0 full cut). */
  cut(): this {
    this.feed(3)
    this.bytes.push(GS, 0x56, 1)
    return this
  }

  /** Standard cash-drawer kick pulse on pin 2 (RJ11 pin most drawers use). */
  openDrawer(): this {
    this.bytes.push(ESC, 0x70, 0, 25, 250)
    return this
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }
}
