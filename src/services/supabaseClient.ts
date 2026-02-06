import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const AUTH_STORAGE_KEY = 'umoya-erp-auth'
const AUTH_PERSIST_KEY = 'umoya_auth_persist'

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => {
      store.clear()
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

const getPersistPreference = () => {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return window.localStorage.getItem(AUTH_PERSIST_KEY) === 'true'
  } catch {
    return false
  }
}

const getAuthStorage = (persist: boolean) => {
  if (typeof window === 'undefined') {
    return createMemoryStorage()
  }
  return persist ? window.localStorage : window.sessionStorage
}

const createSupabaseClient = (persist: boolean) =>
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: getAuthStorage(persist),
          storageKey: AUTH_STORAGE_KEY,
        },
      })
    : null

export let supabase = createSupabaseClient(getPersistPreference())

export const isSupabaseEnabled = () => !!supabase

export const getSupabaseClient = () => supabase

export const getAuthPersistence = () => getPersistPreference()

export const setAuthPersistence = (persist: boolean) => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AUTH_PERSIST_KEY, persist ? 'true' : 'false')
    } catch {
      // ignore
    }
    if (!persist) {
      try {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }
  supabase = createSupabaseClient(persist)
}

export const supabaseNoPersist =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: getAuthStorage(false),
          storageKey: 'umoya-erp-auth-nopersist',
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null
