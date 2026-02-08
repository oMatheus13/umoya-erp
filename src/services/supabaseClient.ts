import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const AUTH_STORAGE_KEY = 'umoya-erp-auth'
const AUTH_PERSIST_KEY = 'umoya_auth_persist'
const STORAGE_TEST_KEY = '__umoya_storage_test__'

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

const getBrowserStorage = (kind: 'local' | 'session'): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

const canUseStorage = (storage: Storage | null) => {
  if (!storage) {
    return false
  }
  try {
    storage.setItem(STORAGE_TEST_KEY, '1')
    storage.removeItem(STORAGE_TEST_KEY)
    return true
  } catch {
    return false
  }
}

const getPersistPreference = () => {
  const storage = getBrowserStorage('local')
  if (!canUseStorage(storage)) {
    return false
  }
  try {
    return storage?.getItem(AUTH_PERSIST_KEY) === 'true'
  } catch {
    return false
  }
}

const getAuthStorage = (persist: boolean) => {
  if (typeof window === 'undefined') {
    return createMemoryStorage()
  }
  const localStorage = getBrowserStorage('local')
  const sessionStorage = getBrowserStorage('session')
  const canUseLocal = canUseStorage(localStorage)
  const canUseSession = canUseStorage(sessionStorage)
  if (persist && canUseLocal) {
    return localStorage as Storage
  }
  if (canUseSession) {
    return sessionStorage as Storage
  }
  return createMemoryStorage()
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
  const localStorage = getBrowserStorage('local')
  const canPersist = canUseStorage(localStorage)
  if (localStorage && canPersist) {
    try {
      localStorage.setItem(AUTH_PERSIST_KEY, persist ? 'true' : 'false')
    } catch {
      // ignore
    }
    if (!persist) {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }
  supabase = createSupabaseClient(persist && canPersist)
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
