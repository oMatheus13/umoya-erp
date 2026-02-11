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
      const rows = payloads.map((payload) => ({
        order_id: payload.orderId,
        workspace_id: workspaceId,
        payload,
      }))
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
}
