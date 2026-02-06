import { useState, type FormEvent } from 'react'
import logotipo from '../../assets/brand/logotipo.svg'
import loginMock from '../../assets/brand/login-mock-3.webp'
import { dataService } from '../../services/dataService'
import {
  getAuthPersistence,
  getSupabaseClient,
  isSupabaseEnabled,
  setAuthPersistence,
} from '../../services/supabaseClient'
import type { User } from '@supabase/supabase-js'

type LoginProps = {
  onLogin: (user: User) => void
  onDevLogin?: () => void
}

type LoginForm = {
  identifier: string
  password: string
}

const createEmptyLogin = (): LoginForm => ({
  identifier: '',
  password: '',
})

const normalizeEmail = (value: string) => value.trim().toLowerCase()
const normalizeCpf = (value: string) => value.replace(/\D/g, '')
const buildCpfEmail = (cpf: string) => `${cpf}@umoya.cpf`

const Login = ({ onLogin, onDevLogin }: LoginProps) => {
  const [status, setStatus] = useState<string | null>(null)
  const [loginForm, setLoginForm] = useState<LoginForm>(createEmptyLogin())
  const [rememberMe, setRememberMe] = useState(() => getAuthPersistence())
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('')
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null)
  const supabaseEnabled = isSupabaseEnabled()

  const updateLoginForm = (patch: Partial<LoginForm>) => {
    setLoginForm((prev) => ({ ...prev, ...patch }))
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!loginForm.identifier.trim() || !loginForm.password.trim()) {
      setStatus('Informe email ou CPF e senha.')
      return
    }

    setAuthPersistence(rememberMe)
    const client = getSupabaseClient()
    if (!client) {
      setStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return
    }
    const identifier = loginForm.identifier.trim()
    let normalizedEmail = ''
    let usedCpfFallback = false
    if (identifier.includes('@')) {
      normalizedEmail = normalizeEmail(identifier)
    } else {
      const cpf = normalizeCpf(identifier)
      if (!cpf || cpf.length !== 11) {
        setStatus('Informe um CPF valido com 11 digitos.')
        return
      }
      const data = dataService.getAll()
      const matchedUserByCpf = data.usuarios.find(
        (user) => normalizeCpf(user.cpf ?? '') === cpf,
      )
      const matchedEmployee = data.funcionarios.find(
        (employee) => normalizeCpf(employee.cpf ?? '') === cpf,
      )
      const matchedUser =
        matchedUserByCpf ??
        (matchedEmployee
          ? data.usuarios.find((user) => user.employeeId === matchedEmployee.id)
          : undefined)
      if (!matchedUser) {
        normalizedEmail = normalizeEmail(buildCpfEmail(cpf))
        usedCpfFallback = true
      } else {
        normalizedEmail = normalizeEmail(matchedUser.email)
      }
    }
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password: loginForm.password,
      })
      if (error) {
        if (usedCpfFallback) {
          setStatus(
            'CPF nao encontrado neste dispositivo. Use o email cadastrado para acessar.',
          )
          return
        }
        setStatus(error.message)
        return
      }
      if (!data.user) {
        setStatus('Nao foi possivel autenticar.')
        return
      }
      setStatus(null)
      onLogin(data.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      setStatus(`Falha ao conectar no Supabase. ${message}`)
    }
  }

  const handleRecoveryToggle = () => {
    setRecoveryOpen((prev) => !prev)
    setRecoveryStatus(null)
    if (!recoveryIdentifier && loginForm.identifier.trim()) {
      setRecoveryIdentifier(loginForm.identifier.trim())
    }
  }

  const handleRecoverySubmit = async () => {
    if (!recoveryIdentifier.trim()) {
      setRecoveryStatus('Informe email ou CPF para recuperar.')
      return
    }
    const client = getSupabaseClient()
    if (!client) {
      setRecoveryStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return
    }
    const identifier = recoveryIdentifier.trim()
    let email = ''
    if (identifier.includes('@')) {
      email = normalizeEmail(identifier)
    } else {
      const cpf = normalizeCpf(identifier)
      if (!cpf || cpf.length !== 11) {
        setRecoveryStatus('Informe um CPF valido com 11 digitos.')
        return
      }
      email = normalizeEmail(buildCpfEmail(cpf))
    }
    setRecoveryStatus('Enviando link de recuperacao...')
    try {
      const redirectTo =
        typeof window !== 'undefined' ? window.location.origin : undefined
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        setRecoveryStatus(error.message)
        return
      }
      setRecoveryStatus('Enviamos um link para redefinir sua senha.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      setRecoveryStatus(`Falha ao enviar email. ${message}`)
    }
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__mock">
          <img src={loginMock} alt="" />
        </div>

        <div className="login__auth">
          <img className="login__logo" src={logotipo} alt="Umoya ERP" />

          {!supabaseEnabled ? (
            <p className="login__status">
              Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no arquivo `.env` para
              ativar login.
            </p>
          ) : (
            <form className="login__form" onSubmit={handleLoginSubmit}>
              <input
                id="login-identifier"
                className="form__input"
                type="text"
                value={loginForm.identifier}
                onChange={(event) => updateLoginForm({ identifier: event.target.value })}
                placeholder="Email ou CPF"
              />

              <div className="login__password">
                <div className="login__field">
                  <input
                    id="password"
                    className="form__input"
                    type={showPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={(event) => updateLoginForm({ password: event.target.value })}
                    placeholder="Senha"
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
                <button className="login__forgot" type="button" onClick={handleRecoveryToggle}>
                  Esqueceu sua senha?
                </button>
              </div>

              {status && <p className="login__status">{status}</p>}

              {recoveryOpen && (
                <div className="login__recovery">
                  <input
                    id="login-recovery"
                    className="form__input"
                    type="text"
                    value={recoveryIdentifier}
                    onChange={(event) => setRecoveryIdentifier(event.target.value)}
                    placeholder="Email ou CPF do acesso"
                  />
                  <div className="login__recovery-actions">
                    <button
                      className="button button--primary button--sm"
                      type="button"
                      onClick={handleRecoverySubmit}
                    >
                      Enviar link
                    </button>
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={() => {
                        setRecoveryOpen(false)
                        setRecoveryStatus(null)
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                  {recoveryStatus && <p className="login__status">{recoveryStatus}</p>}
                </div>
              )}

              <div className="login__actions">
                <label className="toggle login__remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span className="toggle__track" aria-hidden="true">
                    <span className="toggle__thumb" />
                  </span>
                  <span className="toggle__label">Manter conectado</span>
                </label>

                <div className="login__buttons">
                  <button
                    className="button button--primary button--sm login__button"
                    type="submit"
                  >
                    Entrar
                  </button>
                  {onDevLogin && (
                    <button
                      className="button button--ghost button--sm login__dev-button"
                      type="button"
                      onClick={onDevLogin}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        science
                      </span>
                      Dev
                    </button>
                  )}
                </div>
              </div>

              <p className="login__hint">
                Não tem uma conta? <br />
                Solicite acesso ao administrador.
              </p>
            </form>
          )}

          {!supabaseEnabled && onDevLogin && (
            <div className="login__dev">
              <button
                className="button button--ghost button--sm login__dev-button"
                type="button"
                onClick={onDevLogin}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  science
                </span>
                Dev
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
