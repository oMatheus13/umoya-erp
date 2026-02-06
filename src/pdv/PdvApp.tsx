import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import Login from '../pages/core/Login'
import ResetPassword from '../pages/core/ResetPassword'
import { supabase } from '../services/supabaseClient'

const resolveRecoveryMode = () => {
  if (typeof window === 'undefined') {
    return false
  }
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('type') === 'recovery'
}

const resolveDisplayName = (user: User) => {
  const metadata = user.user_metadata as Record<string, unknown> | null
  const displayName = metadata?.displayName
  const legacyDisplayName = metadata?.display_name
  const name = metadata?.name
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName
  }
  if (typeof legacyDisplayName === 'string' && legacyDisplayName.trim()) {
    return legacyDisplayName
  }
  if (typeof name === 'string' && name.trim()) {
    return name
  }
  return user.email ?? 'Usuario'
}

const PdvApp = () => {
  const [isRecoveryMode, setIsRecoveryMode] = useState(resolveRecoveryMode)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (!supabase) {
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (user && !isRecoveryMode) {
        setCurrentUser(user)
        setIsAuthenticated(true)
      }
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setCurrentUser(user)
      setIsAuthenticated(!!user)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [isRecoveryMode])

  const handleLogin = (user: User) => {
    setCurrentUser(user)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    if (supabase) {
      void supabase.auth.signOut()
    }
    setCurrentUser(null)
    setIsAuthenticated(false)
  }

  if (isRecoveryMode) {
    return (
      <ResetPassword
        onDone={() => {
          setIsRecoveryMode(false)
        }}
      />
    )
  }

  if (!isAuthenticated || !currentUser) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="pdv">
      <header className="pdv__header">
        <div className="pdv__headline">
          <p className="pdv__eyebrow">Umoya PDV</p>
          <h1 className="pdv__title">PDV em preparo</h1>
          <p className="pdv__subtitle">
            Base pronta para criar fluxo de caixa, pagamentos e vendas.
          </p>
        </div>
        <div className="pdv__user">
          <div className="pdv__user-meta">
            <span className="pdv__user-label">Operador</span>
            <strong className="pdv__user-name">{resolveDisplayName(currentUser)}</strong>
            {currentUser.email && (
              <span className="pdv__user-email">{currentUser.email}</span>
            )}
          </div>
          <button
            className="button button--ghost button--sm"
            type="button"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </header>

      <main className="pdv__content">
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Estrutura criada</h2>
            <p className="card__meta">Entradas separadas por dominio</p>
          </div>
          <div className="card__stack">
            <p className="pdv__text">
              Este app usa o mesmo login e banco do ERP. Aqui vamos montar as
              telas do PDV.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default PdvApp
