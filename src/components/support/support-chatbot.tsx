'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Send, X, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function SupportChatbot({ lang }: { lang: string }) {
  const t = useTranslations('support')
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || isSending) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, lang }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: t('chatbotError') }])
        return
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: json.reply }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('chatbotError') }])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-slate-200/65 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:w-96">
          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="text-sm font-semibold">{t('chatbotTitle')}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {t('chatbotWelcome')}
              </div>
            </div>
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'rounded-tr-sm bg-indigo-600 text-white'
                      : 'rounded-tl-sm bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> {t('chatbotThinking')}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200/65 p-3 dark:border-slate-800">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={t('chatbotPlaceholder')}
              className="h-9 flex-1 rounded-xl border-slate-200 text-sm"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="h-9 w-9 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={t('chatbotTitle')}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </>
  )
}
