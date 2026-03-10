import type { AuditCategory, AuditEvent, ERPData } from '../types/erp'
import { createId } from '../utils/ids'

export type AuditInput = {
  category: AuditCategory
  title: string
  description?: string
  actorName?: string
  metadata?: string
}

const AUDIT_RETENTION_DAYS = 120
const AUDIT_MAX_RECORDS = 600
const AUDIT_DEDUPE_MS = 2 * 60 * 1000

const toTimestamp = (value?: string) => {
  if (!value) {
    return 0
  }
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

export const appendAuditEvent = (payload: ERPData, input: AuditInput) => {
  const now = new Date()
  const nowTime = now.getTime()
  const cutoff = nowTime - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000

  const existing = Array.isArray(payload.auditoria) ? payload.auditoria : []
  const filtered = existing.filter((entry) => toTimestamp(entry.createdAt) >= cutoff)

  const lastEntry = filtered.reduce<AuditEvent | null>((latest, entry) => {
    if (!latest) {
      return entry
    }
    return toTimestamp(entry.createdAt) > toTimestamp(latest.createdAt) ? entry : latest
  }, null)

  if (
    lastEntry &&
    lastEntry.category === input.category &&
    lastEntry.title === input.title &&
    (lastEntry.actorName ?? '') === (input.actorName ?? '') &&
    nowTime - toTimestamp(lastEntry.createdAt) < AUDIT_DEDUPE_MS
  ) {
    payload.auditoria = filtered
    return payload
  }

  const next: AuditEvent = {
    id: createId(),
    category: input.category,
    title: input.title,
    description: input.description,
    actorName: input.actorName,
    metadata: input.metadata,
    createdAt: now.toISOString(),
  }

  const nextEntries = [...filtered, next].slice(-AUDIT_MAX_RECORDS)
  payload.auditoria = nextEntries
  return payload
}
