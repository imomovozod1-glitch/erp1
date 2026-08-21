import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { getGeminiModel } from '@/lib/gemini'

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(30),
  lang: z.enum(['uz', 'ru', 'en']).default('uz'),
})

const SYSTEM_INSTRUCTIONS: Record<string, string> = {
  uz: "Siz ushbu ERP tizimi (ombor, sotuv, xarid, moliya, HR, POS) bo'yicha yordamchi botsiz. Foydalanuvchilarga tizimdan qanday foydalanish bo'yicha qisqa, aniq va do'stona javob bering. Agar savol ERP bilan bog'liq bo'lmasa yoki texnik yordam (masalan, hisob bloklanishi, to'lov muammosi) kerak bo'lsa, ularni Telegram (@erpsupport_bot) yoki telefon (+998 71 200 00 00) orqali qo'llab-quvvatlash xizmatiga murojaat qilishni tavsiya eting. Javoblaringizni o'zbek tilida bering.",
  ru: 'Вы — бот-помощник по этой ERP-системе (склад, продажи, закупки, финансы, HR, POS). Давайте пользователям краткие, точные и дружелюбные ответы о том, как пользоваться системой. Если вопрос не связан с ERP или требуется техническая поддержка (например, блокировка аккаунта, проблема с оплатой), порекомендуйте обратиться в поддержку через Telegram (@erpsupport_bot) или по телефону (+998 71 200 00 00). Отвечайте на русском языке.',
  en: "You are a support chatbot for this ERP system (inventory, sales, procurement, finance, HR, POS). Give users short, accurate, friendly answers about how to use the system. If the question isn't ERP-related or needs human/technical support (e.g. account blocked, payment issue), recommend contacting support via Telegram (@erpsupport_bot) or phone (+998 71 200 00 00). Reply in English.",
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const parsed = chatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const { messages, lang } = parsed.data

  try {
    const model = getGeminiModel('gemini-1.5-flash', false, SYSTEM_INSTRUCTIONS[lang])
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1].content

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(lastMessage)
    const reply = result.response.text()

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('Support chat error:', err)
    return NextResponse.json({ error: 'Failed to get a response' }, { status: 502 })
  }
}
