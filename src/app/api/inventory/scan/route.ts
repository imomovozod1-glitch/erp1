import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithOpenAI } from '@/lib/openai'

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

    const prompt = `Siz ERP ombor tizimi uchun hujjatlarni tahlil qiluvchi AI yordamchisiz.
Ushbu rasmdan (nakladnoy, schyot-faktura yoki xarid cheki) ta'minotchi (supplier) nomini va mahsulotlar ro'yxatini aniqlang.
Natijani FAQAT QUYIDAGI VALID JSON formatida qaytaring:

{
  "supplier": "Ta'minotchi kompaniya yoki shaxs nomi (agar rasmdan aniqlansa, aks holda bo'sh string)",
  "items": [
    {
      "name": "Mahsulot nomi",
      "sku": "Artikul yoki kod (agar rasmdan aniqlansa, aks holda nomidan kelib chiqib qisqa kod generatsiya qiling, masalan: MEB-001)",
      "unit": "O'lchov birligi (masalan: dona, metr, kg, m²)",
      "quantity": 10,
      "cost_price": 50000
    }
  ]
}

Qoidalar:
1. Har bir aniqlangan mahsulot uchun items ro'yxatida bitta obyekt yarating.
2. quantity va cost_price qiymatlarini faqat raqam (number) ko'rinishida yozing.
3. O'lchov birligi bo'lmasa "dona" deb yozing.
4. Javobingiz faqat va faqat to'g'ri JSON formatida bo'lsin, hech qanday ortiqcha tushuntirish yozmang.`

    let text = await analyzeImageWithOpenAI(file, prompt, true)

    if (!text) {
      return NextResponse.json(
        { error: 'Rasmdan ma`lumotlarni o`qib bo`lmadi.' },
        { status: 400 }
      )
    }

    // Clean markdown code blocks if present
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    // Try to locate JSON boundaries
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      text = jsonMatch[0]
    }

    const parsedData = JSON.parse(text)
    
    // Ensure standard structure
    return NextResponse.json({
      supplier: parsedData.supplier || '',
      items: parsedData.items || []
    })
  } catch (error: unknown) {
    console.error('Inventory AI Scan Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rasmni tahlil qilishda xatolik yuz berdi' },
      { status: 500 }
    )
  }
}
