import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithOpenAI } from '@/lib/openai'
import { getTenantContext } from '@/lib/auth'
import { canDo } from '@/lib/permissions-server'
import { validateImageUpload } from '@/lib/file-validation'

export async function POST(request: NextRequest) {
  // A paid API: only an active member of an active company who may add goods
  // (the screens that call this) gets to spend on it.
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [a, b] = await Promise.all([canDo('inventory', 'create'), Promise.resolve(false)])
  if (!a && !b) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'image_file_missing' },
        { status: 400 }
      )
    }

    const uploadError = validateImageUpload(file)
    if (uploadError) {
      // validateImageUpload answers English text; the client gets a code.
      return NextResponse.json(
        { error: /large/i.test(uploadError) ? 'image_too_large' : 'image_type_unsupported' },
        { status: 400 }
      )
    }

    const defaultPrompt = `Analyze this document/image for an ERP system. 
    Extract the key information in a structured format (JSON if possible, or clear text). 
    If it's an invoice, extract: vendor, date, total amount, and line items.
    If it's a generic document, extract the main text and summarize key entities.`

    // The prompt is the server's own: a caller-supplied one turned this into a
    // general-purpose paid model endpoint.
    const finalPrompt = defaultPrompt
    const text = await analyzeImageWithOpenAI(file, finalPrompt, false)

    return NextResponse.json({ result: text })
  } catch (error: unknown) {
    console.error('OCR Error:', error)
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    )
  }
}
