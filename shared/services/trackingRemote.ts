import type { TrackingOrderPayload } from '../types/tracking'
import { supabase } from './supabaseClient'

type RemoteResult<T> = { data: T | null; error?: string }

export const trackingRemote = {
  async upsertOrders(
    workspaceId: string,
    payloads: TrackingOrderPayload[],
  ): Promise<RemoteResult<boolean>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    if (payloads.length === 0) {
      return { data: true }
    }
    try {
      const rows: Array<{ order_id: string; workspace_id: string; payload: TrackingOrderPayload }> =
        []
      const seen = new Set<string>()
      payloads.forEach((payload) => {
        const code = (payload.orderCode || payload.orderId).trim().toLowerCase()
        if (!code || seen.has(code)) {
          return
        }
        rows.push({ order_id: code, workspace_id: workspaceId, payload })
        seen.add(code)
      })
      const { error } = await supabase.from('tracking_orders').upsert(rows, {
        onConflict: 'order_id',
      })
      if (error) {
        return { data: null, error: error.message }
      }
      return { data: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      return { data: null, error: message }
    }
  },
  async deleteOrders(
    workspaceId: string,
    orderCodes: string[],
  ): Promise<RemoteResult<boolean>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    const ids = new Set<string>()
    orderCodes.forEach((code) => {
      const normalized = code.trim().toLowerCase()
      if (normalized) {
        ids.add(normalized)
      }
    })
    const list = Array.from(ids)
    if (list.length === 0) {
      return { data: true }
    }
    try {
      const { error } = await supabase
        .from('tracking_orders')
        .delete()
        .eq('workspace_id', workspaceId)
        .in('order_id', list)
      if (error) {
        return { data: null, error: error.message }
      }
      return { data: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      return { data: null, error: message }
    }
  },
}
