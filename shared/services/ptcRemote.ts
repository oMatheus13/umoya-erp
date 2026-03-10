import type { PtcState } from '../types/ptc'
import { supabase } from './supabaseClient'

type RemoteResult<T> = { data: T | null; error?: string; updatedAt?: string }

export const ptcRemote = {
  async fetchState(syncId: string): Promise<RemoteResult<PtcState>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    try {
      const { data, error } = await supabase
        .from('ptc_states')
        .select('payload, updated_at')
        .eq('user_id', syncId)
        .maybeSingle()
      if (error) {
        return { data: null, error: error.message }
      }
      return {
        data: (data?.payload as PtcState) ?? null,
        updatedAt: data?.updated_at ?? undefined,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      return { data: null, error: message }
    }
  },
  async upsertState(syncId: string, payload: PtcState): Promise<RemoteResult<boolean>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    try {
      const { error } = await supabase.from('ptc_states').upsert(
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
