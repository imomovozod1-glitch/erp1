import { NextRequest, NextResponse } from 'next/server'
import { getGeminiModel, fileToGenerativePart } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const prompt = formData.get('prompt') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'Rasm fayli yuklanmagan' },
        { status: 400 }
      )
    }

    if (!process.env.GEMINI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: 'Server sozlamalari xatosi: GEMINI_API_KEY sozlanmagan' },
        { status: 500 }
      )
    }

    const defaultPrompt = `Analyze this document/image for an ERP system. 
    Extract the key information in a structured format (JSON if possible, or clear text). 
    If it's an invoice, extract: vendor, date, total amount, and line items.
    If it's a generic document, extract the main text and summarize key entities.`

    const finalPrompt = prompt || defaultPrompt
    const imagePart = await fileToGenerativePart(file)

    const model = getGeminiModel('gemini-1.5-flash')
    const result = await model.generateContent([finalPrompt, imagePart])
    const response = await result.response
    const text = response.text()

    return NextResponse.json({ result: text })
  } catch (error: unknown) {
    console.error('OCR Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rasmni o`qishda xatolik yuz berdi' },
      { status: 500 }
    )
  }
}
