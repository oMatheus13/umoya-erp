import type { PasState } from '../types/pas'
import { supabase } from './supabaseClient'

type RemoteResult<T> = { data: T | null; error?: string; updatedAt?: string }

export const pasRemote = {
  async fetchState(syncId: string): Promise<RemoteResult<PasState>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    try {
      const { data, error } = await supabase
        .from('pas_graphs')
        .select('payload, updated_at')
        .eq('user_id', syncId)
        .maybeSingle()
      if (error) {
        return { data: null, error: error.message }
      }
      return {
        data: (data?.payload as PasState) ?? null,
        updatedAt: data?.updated_at ?? undefined,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      return { data: null, error: message }
    }
  },
  async upsertState(syncId: string, payload: PasState): Promise<RemoteResult<boolean>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    try {
      const { error } = await supabase.from('pas_graphs').upsert(
        {
          user_id: syncId,
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
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
