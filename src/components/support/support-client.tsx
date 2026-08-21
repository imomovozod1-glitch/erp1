'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { 
  Send, 
  MessageSquare, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Bot
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SupportChatbot } from '@/components/support/support-chatbot'

interface SupportClientProps {
  lang: string
}

export function SupportClient({ lang }: SupportClientProps) {
  const t = useTranslations('support')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      toast.error(lang === 'uz' ? "Mavzu va xabar to'ldirilishi shart" : lang === 'ru' ? 'Тема и сообщение обязательны для заполнения' : 'Subject and message are required')
      return
    }

    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
      toast.success(t('ticketSuccess'))
      setSubject('')
      setMessage('')
    }, 1500)
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} ${lang === 'uz' ? "nusxalandi" : lang === 'ru' ? "скопировано" : "copied"}`)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t('title')}
        subtitle={t('description')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
        ]}
      >
        <PageClock lang={lang} />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Telegram Card */}
        <a 
          href="https://t.me/erpsupport_bot" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group relative overflow-hidden bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/65 dark:border-slate-800 hover:border-indigo-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-bl-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300" />
          <div>
            <div className="p-3 bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 rounded-2xl w-fit mb-4">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 transition-colors">
              {t('contactTelegram')}
            </h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {t('contactTelegramDesc')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400 text-xs font-semibold mt-4 group-hover:gap-2 transition-all">
            <span>@erpsupport_bot</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </a>

        {/* Phone Card */}
        <div 
          onClick={() => handleCopy('+998712000000', 'Phone')}
          className="group relative overflow-hidden bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/65 dark:border-slate-800 hover:border-indigo-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300" />
          <div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl w-fit mb-4">
              <Phone className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
              {t('contactPhone')}
            </h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {t('contactPhoneDesc')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mt-4 group-hover:gap-2 transition-all">
            <span>+998 (71) 200-00-00</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>

        {/* Email Card */}
        <div 
          onClick={() => handleCopy('support@erpsystem.uz', 'Email')}
          className="group relative overflow-hidden bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/65 dark:border-slate-800 hover:border-indigo-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300" />
          <div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl w-fit mb-4">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
              {t('contactEmail')}
            </h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {t('contactEmailDesc')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mt-4 group-hover:gap-2 transition-all">
            <span>support@erpsystem.uz</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Support Ticket Form */}
        <Card className="lg:col-span-3 border-slate-200/65 shadow-md dark:border-slate-850 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              {t('submitTicket')}
            </CardTitle>
            <CardDescription>
              {lang === 'uz' ? "Xabaringizni yozib qoldiring va biz tez orada siz bilan bog'lanamiz." : lang === 'ru' ? 'Оставьте сообщение, и мы свяжемся с вами в ближайшее время.' : 'Leave a message and we will respond to you shortly.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in-50 zoom-in-95 duration-300">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-full mb-4 animate-bounce">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{lang === 'uz' ? "Murojaat qabul qilindi!" : lang === 'ru' ? 'Обращение принято!' : 'Ticket Received!'}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2">{t('ticketSuccess')}</p>
                <Button 
                  onClick={() => setIsSubmitted(false)}
                  className="mt-6 bg-indigo-600 hover:bg-indigo-500"
                >
                  {lang === 'uz' ? "Yangi murojaat yuborish" : lang === 'ru' ? 'Отправить новое обращение' : 'Send New Ticket'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {t('ticketSubject')}
                  </label>
                  <Input 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={lang === 'uz' ? "Misol: To'lov tizimidagi muammo" : lang === 'ru' ? 'Например: Проблема с оплатой' : 'Example: Issue with payment'}
                    className="rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {t('ticketMessage')}
                  </label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={lang === 'uz' ? "Batafsil ma'lumot qoldiring..." : lang === 'ru' ? 'Подробно опишите вашу проблему...' : 'Describe your issue in detail...'}
                    className="rounded-xl border-slate-200 min-h-[120px] focus-visible:ring-indigo-500"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 font-medium rounded-xl gap-2 h-11"
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? (lang === 'uz' ? 'Yuborilmoqda...' : lang === 'ru' ? 'Отправка...' : 'Sending...') : t('submitTicket')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Sidebar Info Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Operator Status */}
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-6 rounded-2xl relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-8 -translate-y-8" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                  {t('liveStatus')}
                </span>
              </div>
              <h3 className="text-xl font-extrabold leading-snug">
                {lang === 'uz' ? 'Har doim aloqadamiz' : lang === 'ru' ? 'Всегда на связи' : 'Always Connected'}
              </h3>
              <p className="text-xs text-indigo-100/90 leading-relaxed">
                {t('liveStatusDesc')}
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs font-semibold bg-white/15 px-3 py-2 rounded-xl w-fit">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Premium Support Active</span>
              </div>
            </div>
          </div>

          {/* Security & Confidentiality */}
          <div className="bg-slate-50 dark:bg-slate-905 border border-slate-200/50 p-6 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <span>{lang === 'uz' ? "Xavfsizlik kafolati" : lang === 'ru' ? 'Гарантия безопасности' : 'Security Guarantee'}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === 'uz' 
                ? "Sizning barcha ma'lumotlaringiz va murojaatlaringiz shifrlangan holda yuboriladi va uchinchi shaxslarga berilmaydi." 
                : lang === 'ru' 
                ? 'Все ваши данные и обращения отправляются в зашифрованном виде и не передаются третьим лицам.' 
                : 'All your data and communications are encrypted and are never shared with third parties.'}
            </p>
          </div>
        </div>
      </div>

      <SupportChatbot lang={lang} />
    </div>
  )
}
