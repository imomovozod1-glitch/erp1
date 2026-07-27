import { NextRequest, NextResponse } from 'next/server'
import { getGeminiModel, fileToGenerativePart } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Rasm fayli yuklanmagan' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY sozlanmagan. Iltimos, .env.local fayliga GEMINI_API_KEY kalitini qo`shing (Google AI Studio da bepul taqdim etiladi).',
        },
        { status: 400 }
      )
    }

    const prompt = `Siz ERP ombor tizimi uchun hujjat va yuk rasmlarini tahlil qiluvchi AI yordamchisiz.
Ushbu rasmda ko'rsatilgan ombor tovarlari, nakladnoy, chek yoki yuklar ro'yxatidan barcha mahsulotlarni o'qib oling.
Natijani FAQAT QUYIDAGI VALID JSON ARRAY formatida qaytaring:

[
  {
    "name": "Mahsulot nomi",
    "sku": "Artikul yoki kod (agar rasimda bo'lmasa mantiqiy SKU masalan: PRD-001)",
    "unit": "O'lchov birligi (masalan: dona, kg, m, litr, qop)",
    "stock": 10,
    "price": 50000,
    "cost_price": 40000,
    "category": "Kategoriya nomi"
  }
]

Qoidalar:
1. Har bir aniqlangan mahsulot uchun bitta obyekt yarating.
2. Stock, price, cost_price qiymatlarini faqat raqam (number) ko'rinishida yozing.
3. O'lchov birligi bo'lmasa "dona" deb bering.`

    const imagePart = await fileToGenerativePart(file)

    // Use JSON mode for guaranteed structured JSON response
    let text = ''
    try {
      const model = getGeminiModel('gemini-1.5-flash', true)
      const result = await model.generateContent([prompt, imagePart])
      const response = await result.response
      text = response.text().trim()
    } catch (primaryErr: unknown) {
      console.warn('gemini-1.5-flash failed, trying gemini-2.0-flash with JSON mode...', primaryErr)
      const modelFallback = getGeminiModel('gemini-2.0-flash', true)
      const result = await modelFallback.generateContent([prompt, imagePart])
      const response = await result.response
      text = response.text().trim()
    }

    if (!text) {
      return NextResponse.json(
        { error: 'Rasmdan mahsulotlar ma`lumoti o`qilmadi. Rasm aniqroq ekanini tekshiring.' },
        { status: 400 }
      )
    }

    // Clean markdown if still present
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    const arrayMatch = text.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      text = arrayMatch[0]
    }

    const parsedItems = JSON.parse(text)
    return NextResponse.json({ items: parsedItems })
  } catch (error: unknown) {
    console.error('Inventory AI Scan Error:', error)

    const rawMessage = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      { error: rawMessage },
      { status: 400 }
    )
  }
}
