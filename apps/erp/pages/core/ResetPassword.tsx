import { useState, type FormEvent } from 'react'
import logotipo from '@shared/assets/brand/logotipo.svg'
import loginMockErp from '@shared/assets/brand/login-mock-3.webp'
import loginMockPdv from '@shared/assets/brand/login-mock-2.webp'
import QuickNotice from '../../components/QuickNotice'
import { supabase } from '@shared/services/supabaseClient'
import { resolveAppKind } from '@shared/utils/appContext'

type ResetPasswordProps = {
  onDone: () => void
}

const ResetPassword = ({ onDone }: ResetPasswordProps) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [done, setDone] = useState(false)
  const appKind = resolveAppKind()
  const appLabel =
    appKind === 'pdv'
      ? 'PDV'
      : appKind === 'pop'
        ? 'POP'
        : appKind === 'ptc'
          ? 'PTC'
          : appKind === 'pas'
            ? 'PAS'
          : 'ERP'
  const appMock = appKind === 'pdv' ? loginMockPdv : loginMockErp

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password.trim() || password.length < 6) {
      setStatus('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setStatus('As senhas nao conferem.')
      return
    }
    if (!supabase) {
      setStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setStatus(error.message)
      return
    }
    setDone(true)
    setStatus('Senha atualizada. Faça login novamente.')
  }

  const handleBackToLogin = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    onDone()
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__mock">
          <img src={appMock} alt="" />
        </div>

        <div className="login__auth">
          <div className="login__brand">
            <img className="login__logo" src={logotipo} alt={`Umoya ${appLabel}`} />
            <span className="login__app-badge">{appLabel}</span>
          </div>

          <form className="login__form" onSubmit={handleSubmit}>
            <div className="login__password">
              <div className="login__field">
                <input
                  id="reset-password"
                  className="form__input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nova senha"
                />
                <button
                  className="login__toggle"
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="login__password">
              <div className="login__field">
                <input
                  id="reset-confirm"
                  className="form__input"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Confirme a senha"
                />
                <button
                  className="login__toggle"
                  type="button"
                  aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showConfirm}
                  onClick={() => setShowConfirm((prev) => !prev)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {showConfirm ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <QuickNotice message={status} onClear={() => setStatus(null)} />

            <div className="login__actions">
              <div className="login__buttons">
                {!done ? (
                  <button className="button button--primary button--sm login__button" type="submit">
                    Atualizar senha
                  </button>
                ) : (
                  <button
                    className="button button--primary button--sm login__button"
                    type="button"
                    onClick={handleBackToLogin}
                  >
                    Voltar para login
                  </button>
                )}
              </div>
            </div>

            <p className="login__hint">
              Defina uma nova senha para acessar o sistema.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
