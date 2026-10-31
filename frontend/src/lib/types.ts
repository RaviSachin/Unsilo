export type SetupItem = { source: string; text: string }

export type Health = {
  ok: boolean
  ai: string
  google_configured: boolean
  google_connected: boolean
  drive_mode: 'oauth' | 'api_key' | 'none'
  selected_groups: number
  reference_date: string
  setup: SetupItem[]
  counts: { emails: number; documents: number; whatsapp_messages: number }
  webhook?: { last: string | null; result: string | null; calls: number; tunnel: string | null }
  whatsapp_direct?: boolean
}

export type SelfTest = { url: string; ok: boolean; steps: { name: string; ok: boolean; detail: string }[] }

export type CriticalFlag = { filename: string; kind: string; reason: string }

export type EmailMeta = {
  id: string
  thread_id: string
  from_addr: string
  from_name: string
  to: string[]
  subject: string
  snippet: string
  sent_at: string
  labels: string[]
  attachments: { filename: string; mime_type: string; preview?: string }[]
  team: 'sales' | 'marketing' | 'other' | null
  team_reason: string | null
  team_method: string | null
  unanswered_days: number | null
  critical: CriticalFlag[]
  url: string
}

export type EmailFull = EmailMeta & { body: string; thread: (EmailMeta & { body: string })[] }

export type EmailList = { reference_date: string; unanswered_days: number; emails: EmailMeta[] }

export type DriveDoc = {
  id: string
  name: string
  mime_type: string
  modified_at: string
  url: string
  category: 'sales' | 'marketing' | 'verification' | 'office' | 'accounts' | null
  reason: string | null
  method: string | null
  preview: string
  has_text: boolean
  error: string | null
}

export type Citation = {
  source_id: string
  type: string
  title: string
  from: string
  date: string
  url: string
  excerpt: string
}

export type AskResult = {
  question: string
  retrieval: { terms: string[]; period: [string, string] | null; sources: string[] }
  answerable: boolean
  mode: 'ai' | 'closest' | 'overview' | 'records' | 'chat' | 'empty' | 'not_found'
  answer: string
  citations: Citation[]
}

export type WaMessage = {
  message_id: string
  group_id: string
  group_name: string | null
  sender_id: string
  sender_name: string | null
  sent_at: string
  type: string
  text: string
}

export type WaInterpretation = {
  summary?: string
  method?: string
  participants?: { name: string; number: string; asking_for: string[]; committing_to: string[] }[]
  action_items?: { task: string; owner: string; due: string; message_ids: string[] }[]
  decisions?: { decision: string; message_ids: string[] }[]
}

export type WaGroup = {
  group_id: string
  name: string
  participants: { wa_id: string; name: string | null }[]
  messages: WaMessage[]
  interpretation: WaInterpretation
}
