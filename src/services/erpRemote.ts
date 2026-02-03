import type { ERPData } from '../types/erp'
import { supabase } from './supabaseClient'

type RemoteResult<T> = { data: T | null; error?: string; updatedAt?: string }

export const erpRemote = {
  async fetchState(userId: string): Promise<RemoteResult<ERPData>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    try {
      const { data, error } = await supabase
        .from('erp_states')
        .select('payload, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) {
        return { data: null, error: error.message }
      }
      return {
        data: (data?.payload as ERPData) ?? null,
        updatedAt: data?.updated_at ?? undefined,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      return { data: null, error: message }
    }
  },
  async upsertState(userId: string, payload: ERPData): Promise<RemoteResult<boolean>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    try {
      const { error } = await supabase.from('erp_states').upsert(
        {
          user_id: userId,
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
  async backupState(userId: string, payload: ERPData): Promise<RemoteResult<boolean>> {
    if (!supabase) {
      return { data: null, error: 'Supabase nao configurado.' }
    }
    try {
      const { error } = await supabase.from('erp_states_backup').insert({
        user_id: userId,
        payload,
        created_at: new Date().toISOString(),
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
