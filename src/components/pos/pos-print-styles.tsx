'use client'

/**
 * Print rules for the thermal slip: only the receipt reaches the paper, on a roll
 * of the configured width with no margin. The dialog popup is flattened because a
 * fixed, translated popup is the containing block for the receipt and would crop it.
 */
export function PosPrintStyles({ widthMm }: { widthMm: number }) {
  return (
    <style jsx global>{`
      @media print {
        @page {
          size: ${widthMm}mm auto;
          margin: 0;
        }
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          height: auto !important;
          overflow: visible !important;
        }
        body > *:not(:has(#pos-thermal-receipt)) {
          display: none !important;
        }
        body * {
          visibility: hidden;
        }
        [data-slot='dialog-content'] {
          position: static !important;
          transform: none !important;
          display: block !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 0 !important;
          background: #fff !important;
          box-shadow: none !important;
        }
        [data-slot='dialog-overlay'],
        [data-slot='dialog-close'],
        [data-base-ui-inert],
        .no-print {
          display: none !important;
        }
        #pos-thermal-receipt,
        #pos-thermal-receipt * {
          visibility: visible;
        }
        #pos-thermal-receipt {
          position: static;
          width: ${widthMm}mm;
          max-width: ${widthMm}mm;
          margin: 0;
          padding: 3mm;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: #fff;
          color: #000;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
        }
      }
      .scrollbar-none::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-none {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .scrollbar-thin::-webkit-scrollbar {
        width: 5px;
        height: 5px;
      }
      .scrollbar-thin::-webkit-scrollbar-track {
        background: transparent;
      }
      .scrollbar-thin::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 9999px;
      }
      .scrollbar-thin::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    `}</style>
  )
}
