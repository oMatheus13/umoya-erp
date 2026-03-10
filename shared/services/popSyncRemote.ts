import type { ERPData } from '../types/erp'
import type { TrackingOrderPayload } from '../types/tracking'

type RemoteResult<T> = { data: T | null; error?: string; updatedAt?: string }

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const POP_SYNC_KEY = import.meta.env.VITE_POP_SYNC_KEY as string | undefined
const POP_SYNC_URL =
  (import.meta.env.VITE_POP_SYNC_URL as string | undefined) ??
  (SUPABASE_URL
    ? `${SUPABASE_URL.replace(/\/$/, '').replace('.supabase.co', '.functions.supabase.co')}/pop-sync`
    : undefined)
const REQUEST_TIMEOUT_MS = 8000

const buildHeaders = (withBody: boolean) => {
  const headers: Record<string, string> = {}
  if (withBody) {
    headers['content-type'] = 'application/json'
  }
  if (POP_SYNC_KEY) {
    headers['x-pop-key'] = POP_SYNC_KEY
  }
  return headers
}

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const parseJson = async (response: Response) => {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

const isAbortError = (err: unknown) =>
  err instanceof DOMException && err.name === 'AbortError'

export const popSyncRemote = {
  async fetchState(): Promise<RemoteResult<ERPData>> {
    if (!POP_SYNC_URL) {
      return { data: null, error: 'POP sync nao configurado.' }
    }
    if (!POP_SYNC_KEY) {
      return { data: null, error: 'POP sync sem chave.' }
    }
    try {
      const response = await fetchWithTimeout(POP_SYNC_URL, {
        method: 'GET',
        headers: buildHeaders(false),
      })
      if (!response.ok) {
        const payload = await parseJson(response)
        const error =
          typeof payload?.error === 'string' ? payload.error : `Erro ${response.status}`
        return { data: null, error }
      }
      const payload = await parseJson(response)
      const data = (payload?.payload as ERPData | null) ?? null
      const updatedAt =
        (payload?.updatedAt as string | undefined) ??
        (payload?.updated_at as string | undefined) ??
        undefined
      return { data, updatedAt }
    } catch (err) {
      if (isAbortError(err)) {
        return { data: null, error: 'timeout' }
      }
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      return { data: null, error: message }
    }
  },
  async upsertState(
    payload: ERPData,
    trackingPayloads?: TrackingOrderPayload[],
  ): Promise<RemoteResult<boolean>> {
    if (!POP_SYNC_URL) {
      return { data: null, error: 'POP sync nao configurado.' }
    }
    if (!POP_SYNC_KEY) {
      return { data: null, error: 'POP sync sem chave.' }
    }
    try {
      const body = JSON.stringify({
        payload,
        trackingPayloads: trackingPayloads?.length ? trackingPayloads : undefined,
      })
      const response = await fetchWithTimeout(POP_SYNC_URL, {
        method: 'POST',
        headers: buildHeaders(true),
        body,
      })
      if (!response.ok) {
        const payload = await parseJson(response)
        const error =
          typeof payload?.error === 'string' ? payload.error : `Erro ${response.status}`
        return { data: null, error }
      }
      return { data: true }
    } catch (err) {
      if (isAbortError(err)) {
        return { data: null, error: 'timeout' }
      }
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      return { data: null, error: message }
    }
  },
}
