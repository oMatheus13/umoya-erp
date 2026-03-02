import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import logotipo from '../assets/brand/logotipo.svg'
import Topbar from '../components/Topbar'
import Login from '../pages/core/Login'
import ResetPassword from '../pages/core/ResetPassword'
import { dataService } from '../services/dataService'
import { erpRemote } from '../services/erpRemote'
import { ptcDataService, setPtcRemoteSync } from '../services/ptcDataService'
import { ptcRemote } from '../services/ptcRemote'
import { supabase } from '../services/supabaseClient'

const resolveRecoveryMode = () => {
  if (typeof window === 'undefined') {
    return false
  }
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('type') === 'recovery'
}

const resolveSyncId = (user: User) =>
  (user.app_metadata?.workspace_id as string | undefined) ?? user.id

const resolveDisplayName = (user: User | null) => {
  if (!user) {
    return 'Usuario'
  }
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const displayName =
    (metadata?.displayName as string | undefined) ??
    (metadata?.display_name as string | undefined) ??
    (metadata?.name as string | undefined)
  return displayName?.trim() || user.email || 'Usuario'
}

const createRemoteSync = (syncId: string) => {
  const SYNC_DEBOUNCE_MS = 500
  let pending: ReturnType<typeof ptcDataService.getAll> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async () => {
    if (!pending) {
      return
    }
    const payload = pending
    pending = null
    const result = await ptcRemote.upsertState(syncId, payload)
    void result
  }

  return (data: ReturnType<typeof ptcDataService.getAll>) => {
    pending = data
    if (timer) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, SYNC_DEBOUNCE_MS)
  }
}

const createDevUser = (id: string, name: string): User => ({
  id,
  email: 'dev@umoya.local',
  user_metadata: { name },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
})

const PtcApp = () => {
  const allowDevMode = import.meta.env && import.meta.env.DEV
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(resolveRecoveryMode)
  const [isSensitiveHidden, setIsSensitiveHidden] = useState(false)

  const loadPtcState = async (user: User) => {
    const resolvedSyncId = resolveSyncId(user)
    const remote = await ptcRemote.fetchState(resolvedSyncId)
    if (remote.data) {
      ptcDataService.replaceAll(remote.data, { touchMeta: false, skipSync: true })
    }
    if (!remote.error) {
      const syncHandler = createRemoteSync(resolvedSyncId)
      setPtcRemoteSync(syncHandler)
    }
  }

  const loadErpState = async (user: User) => {
    const resolvedSyncId = resolveSyncId(user)
    const remote = await erpRemote.fetchState(resolvedSyncId)
    if (remote.data) {
      dataService.replaceAll(remote.data, { touchMeta: false, skipSync: true })
    }
  }

  const startSession = async (user: User) => {
    setCurrentUser(user)
    setIsAuthenticated(true)
    await Promise.all([loadPtcState(user), loadErpState(user)])
  }

  const handleDevLogin = () => {
    const devUser = createDevUser('dev-ptc', 'Dev PTC')
    void startSession(devUser)
  }

  const handleLogout = async () => {
    setPtcRemoteSync(null)
    setCurrentUser(null)
    setIsAuthenticated(false)
    if (supabase) {
      await supabase.auth.signOut()
    }
  }

  if (!isAuthenticated) {
    if (isRecoveryMode) {
      return <ResetPassword onDone={() => setIsRecoveryMode(false)} />
    }
    return (
      <Login
        onLogin={(user) => void startSession(user)}
        onDevLogin={allowDevMode ? () => handleDevLogin() : undefined}
      />
    )
  }

  return (
    <div className="ptc">
      <Topbar
        breadcrumbs={[]}
        brand={<img className="topbar__logo" src={logotipo} alt="Umoya" />}
        userName={resolveDisplayName(currentUser)}
        onLogout={handleLogout}
        isSensitiveHidden={isSensitiveHidden}
        onSensitiveToggle={() => setIsSensitiveHidden((prev) => !prev)}
        showDevTools={allowDevMode}
        searchPlaceholder="Pesquisar"
      />
    </div>
  )
}

export default PtcApp
