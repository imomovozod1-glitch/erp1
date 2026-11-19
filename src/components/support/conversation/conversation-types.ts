import { Building2, Headset, ShieldCheck } from 'lucide-react'
import type { StatusTone } from '@/components/shared/status-badge'

export type SenderRole = 'tenant' | 'agent' | 'admin'
export type Viewer = 'agent' | 'tenant'

export interface ThreadSummary {
  id: string
  kind: 'tenant' | 'agent'
  subject: string
  status: 'open' | 'answered' | 'closed'
  last_message_at: string
  unread: number
  tenant_name?: string | null
}

export interface Message {
  id: string
  sender_role: SenderRole
  sender_name: string
  body: string
  created_at: string
  /** Local-only: shown dimmed until the server confirms the write. */
  pending?: boolean
}

export const STATUS_TONE: Record<ThreadSummary['status'], StatusTone> = { open: 'amber', answered: 'emerald', closed: 'slate' }

export const ROLE_ICON: Record<SenderRole, typeof ShieldCheck> = { admin: ShieldCheck, agent: Headset, tenant: Building2 }

/** "Mine" is role-based: an agent sees admin and tenant messages both as incoming. */
export const isMine = (message: Message, viewer: Viewer) => message.sender_role === viewer
