import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
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

type RecoveryStep = 'request' | 'verify' | 'reset' | 'done'

type IdentifierResolution =
  | {
      email: string
      usedCpfFallback: boolean
    }
  | {
      error: string
    }

const createEmptyLogin = (): LoginForm => ({
  identifier: '',
  password: '',
})

const normalizeEmail = (value: string) => value.trim().toLowerCase()
const normalizeCpf = (value: string) => value.replace(/\D/g, '')
const buildCpfEmail = (cpf: string) => `${cpf}@umoya.cpf`
const RECOVERY_CODE_LENGTH = 6
const createEmptyRecoveryCode = () =>
  Array.from({ length: RECOVERY_CODE_LENGTH }, () => '')
const resolveIdentifierEmail = (identifier: string): IdentifierResolution => {
  const trimmed = identifier.trim()
  if (trimmed.includes('@')) {
    return { email: normalizeEmail(trimmed), usedCpfFallback: false }
  }
  const cpf = normalizeCpf(trimmed)
  if (!cpf || cpf.length !== 11) {
    return { error: 'Informe um CPF valido com 11 digitos.' }
  }
  const data = dataService.getAll()
  const matchedUserByCpf = data.usuarios.find((user) => normalizeCpf(user.cpf ?? '') === cpf)
  const matchedEmployee = data.funcionarios.find(
    (employee) => normalizeCpf(employee.cpf ?? '') === cpf,
  )
  const matchedUser =
    matchedUserByCpf ??
    (matchedEmployee
      ? data.usuarios.find((user) => user.employeeId === matchedEmployee.id)
      : undefined)
  if (!matchedUser) {
    return { email: normalizeEmail(buildCpfEmail(cpf)), usedCpfFallback: true }
  }
  return { email: normalizeEmail(matchedUser.email), usedCpfFallback: false }
}

const Login = ({ onLogin, onDevLogin }: LoginProps) => {
  const [status, setStatus] = useState<string | null>(null)
  const [loginForm, setLoginForm] = useState<LoginForm>(createEmptyLogin())
  const [rememberMe, setRememberMe] = useState(() => getAuthPersistence())
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('')
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null)
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('request')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState<string[]>(() =>
    createEmptyRecoveryCode(),
  )
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [recoveryConfirm, setRecoveryConfirm] = useState('')
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false)
  const [showRecoveryConfirm, setShowRecoveryConfirm] = useState(false)
  const [recoveryVerifying, setRecoveryVerifying] = useState(false)
  const recoveryCodeRefs = useRef<Array<HTMLInputElement | null>>([])
  const autoVerifyTokenRef = useRef('')
  const supabaseEnabled = isSupabaseEnabled()
  const recoveryToken = recoveryCode.join('')

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
    const resolved = resolveIdentifierEmail(loginForm.identifier)
    if ('error' in resolved) {
      setStatus(resolved.error)
      return
    }
    const { email: normalizedEmail, usedCpfFallback } = resolved
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

  const openRecovery = () => {
    setRecoveryOpen(true)
    setRecoveryStep('request')
    setRecoveryStatus(null)
    setRecoveryEmail('')
    setRecoveryCode(createEmptyRecoveryCode())
    setRecoveryPassword('')
    setRecoveryConfirm('')
    setShowRecoveryPassword(false)
    setShowRecoveryConfirm(false)
    setRecoveryVerifying(false)
    autoVerifyTokenRef.current = ''
    if (loginForm.identifier.trim()) {
      setRecoveryIdentifier(loginForm.identifier.trim())
    }
    setStatus(null)
  }

  const closeRecovery = () => {
    setRecoveryOpen(false)
    setRecoveryStep('request')
    setRecoveryStatus(null)
    setRecoveryEmail('')
    setRecoveryCode(createEmptyRecoveryCode())
    setRecoveryPassword('')
    setRecoveryConfirm('')
    setShowRecoveryPassword(false)
    setShowRecoveryConfirm(false)
    setRecoveryVerifying(false)
    autoVerifyTokenRef.current = ''
    setRecoveryIdentifier('')
  }

  const sendRecoveryCode = async (email: string) => {
    const client = getSupabaseClient()
    if (!client) {
      setRecoveryStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return false
    }
    setRecoveryStatus('Enviando codigo...')
    try {
      const redirectTo =
        typeof window !== 'undefined' ? window.location.origin : undefined
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        setRecoveryStatus(error.message)
        return false
      }
      setRecoveryStatus('Codigo enviado. Verifique seu email.')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      setRecoveryStatus(`Falha ao enviar email. ${message}`)
      return false
    }
  }

  const handleRecoveryRequest = async () => {
    if (!recoveryIdentifier.trim()) {
      setRecoveryStatus('Informe email ou CPF para recuperar.')
      return
    }
    const resolved = resolveIdentifierEmail(recoveryIdentifier)
    if ('error' in resolved) {
      setRecoveryStatus(resolved.error)
      return
    }
    setRecoveryEmail(resolved.email)
    setRecoveryCode(createEmptyRecoveryCode())
    setRecoveryVerifying(false)
    autoVerifyTokenRef.current = ''
    const ok = await sendRecoveryCode(resolved.email)
    if (ok) {
      setRecoveryStep('verify')
    }
  }

  const handleRecoveryResend = async () => {
    if (recoveryEmail) {
      setRecoveryVerifying(false)
      autoVerifyTokenRef.current = ''
      setRecoveryCode(createEmptyRecoveryCode())
      await sendRecoveryCode(recoveryEmail)
      return
    }
    await handleRecoveryRequest()
  }

  const handleRecoveryVerify = async (tokenOverride?: string) => {
    if (recoveryVerifying) {
      return
    }
    const token = (tokenOverride ?? recoveryToken).trim()
    if (token.length < RECOVERY_CODE_LENGTH) {
      setRecoveryStatus(`Informe os ${RECOVERY_CODE_LENGTH} digitos enviados.`)
      return
    }
    if (!recoveryEmail) {
      setRecoveryStatus('Solicite o codigo novamente.')
      setRecoveryStep('request')
      return
    }
    const client = getSupabaseClient()
    if (!client) {
      setRecoveryStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return
    }
    setRecoveryVerifying(true)
    setRecoveryStatus('Validando codigo...')
    try {
      const { error } = await client.auth.verifyOtp({
        email: recoveryEmail,
        token,
        type: 'recovery',
      })
      if (error) {
        setRecoveryStatus(error.message)
        return
      }
      setRecoveryStatus(null)
      setRecoveryStep('reset')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      setRecoveryStatus(`Falha ao validar codigo. ${message}`)
    } finally {
      setRecoveryVerifying(false)
    }
  }

  const handleRecoveryUpdate = async () => {
    if (!recoveryPassword.trim() || recoveryPassword.length < 6) {
      setRecoveryStatus('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryStatus('As senhas nao conferem.')
      return
    }
    const client = getSupabaseClient()
    if (!client) {
      setRecoveryStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return
    }
    setRecoveryStatus('Atualizando senha...')
    try {
      const { error } = await client.auth.updateUser({ password: recoveryPassword })
      if (error) {
        setRecoveryStatus(error.message)
        return
      }
      await client.auth.signOut()
      setRecoveryPassword('')
      setRecoveryConfirm('')
      setRecoveryStep('done')
      setRecoveryStatus('Senha atualizada. Faca login novamente.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      setRecoveryStatus(`Falha ao atualizar senha. ${message}`)
    }
  }

  const handleRecoveryFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (recoveryStep === 'request') {
      void handleRecoveryRequest()
      return
    }
    if (recoveryStep === 'verify') {
      void handleRecoveryVerify()
      return
    }
    if (recoveryStep === 'reset') {
      void handleRecoveryUpdate()
      return
    }
    closeRecovery()
  }

  const isRecoveryRequest = recoveryStep === 'request'
  const isRecoveryVerify = recoveryStep === 'verify'
  const isRecoveryReset = recoveryStep === 'reset'
  const isRecoveryDone = recoveryStep === 'done'

  const focusRecoveryIndex = (index: number) => {
    const input = recoveryCodeRefs.current[index]
    if (input) {
      input.focus()
      input.select()
    }
  }

  const applyRecoveryCode = (value: string, startIndex: number) => {
    const digits = value.replace(/\D/g, '')
    if (!digits) {
      const next = [...recoveryCode]
      next[startIndex] = ''
      setRecoveryCode(next)
      return
    }
    const next = [...recoveryCode]
    let lastIndex = startIndex
    for (let offset = 0; offset < digits.length; offset += 1) {
      const index = startIndex + offset
      if (index >= RECOVERY_CODE_LENGTH) break
      next[index] = digits[offset]
      lastIndex = index
    }
    setRecoveryCode(next)
    const nextToken = next.join('').trim()
    if (nextToken.length < RECOVERY_CODE_LENGTH) {
      autoVerifyTokenRef.current = ''
    } else if (
      recoveryOpen &&
      recoveryStep === 'verify' &&
      nextToken.length === RECOVERY_CODE_LENGTH &&
      autoVerifyTokenRef.current !== nextToken
    ) {
      autoVerifyTokenRef.current = nextToken
      void handleRecoveryVerify(nextToken)
    }
    if (lastIndex < RECOVERY_CODE_LENGTH - 1) {
      focusRecoveryIndex(lastIndex + 1)
    }
  }

  const handleRecoveryCodeChange = (index: number, value: string) => {
    applyRecoveryCode(value, index)
  }

  const handleRecoveryCodeKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !recoveryCode[index] && index > 0) {
      event.preventDefault()
      const next = [...recoveryCode]
      next[index - 1] = ''
      setRecoveryCode(next)
      autoVerifyTokenRef.current = ''
      focusRecoveryIndex(index - 1)
    }
  }

  const handleRecoveryCodePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text')
    applyRecoveryCode(text, index)
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
            <form
              className="login__form"
              onSubmit={recoveryOpen ? handleRecoveryFormSubmit : handleLoginSubmit}
            >
              {!recoveryOpen ? (
                <>
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
                    <button className="login__forgot" type="button" onClick={openRecovery}>
                      Esqueceu sua senha?
                    </button>
                  </div>

                  {status && <p className="login__status">{status}</p>}

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
                </>
              ) : (
                <div className="login__recovery">
                  {isRecoveryRequest && (
                    <input
                      id="login-recovery"
                      className="form__input"
                      type="text"
                      value={recoveryIdentifier}
                      onChange={(event) => setRecoveryIdentifier(event.target.value)}
                      placeholder="Email ou CPF do acesso"
                    />
                  )}

                  {isRecoveryVerify && (
                    <>
                      <div className="login__code">
                        {recoveryCode.map((value, index) => (
                          <input
                            key={`code-${index}`}
                            className="login__code-input"
                            type="text"
                            inputMode="numeric"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            aria-label={`Codigo ${index + 1}`}
                            value={value}
                            ref={(element) => {
                              recoveryCodeRefs.current[index] = element
                            }}
                            onChange={(event) => handleRecoveryCodeChange(index, event.target.value)}
                            onKeyDown={(event) => handleRecoveryCodeKeyDown(index, event)}
                            onPaste={(event) => handleRecoveryCodePaste(index, event)}
                          />
                        ))}
                      </div>
                      <button
                        className="login__forgot"
                        type="button"
                        onClick={handleRecoveryResend}
                      >
                        Reenviar codigo
                      </button>
                    </>
                  )}

                  {isRecoveryReset && (
                    <>
                      <div className="login__password">
                        <div className="login__field">
                          <input
                            id="recovery-password"
                            className="form__input"
                            type={showRecoveryPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={recoveryPassword}
                            onChange={(event) => setRecoveryPassword(event.target.value)}
                            placeholder="Nova senha"
                          />
                          <button
                            className="login__toggle"
                            type="button"
                            aria-label={showRecoveryPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            aria-pressed={showRecoveryPassword}
                            onClick={() => setShowRecoveryPassword((prev) => !prev)}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              {showRecoveryPassword ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="login__password">
                        <div className="login__field">
                          <input
                            id="recovery-confirm"
                            className="form__input"
                            type={showRecoveryConfirm ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={recoveryConfirm}
                            onChange={(event) => setRecoveryConfirm(event.target.value)}
                            placeholder="Confirme a senha"
                          />
                          <button
                            className="login__toggle"
                            type="button"
                            aria-label={showRecoveryConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                            aria-pressed={showRecoveryConfirm}
                            onClick={() => setShowRecoveryConfirm((prev) => !prev)}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              {showRecoveryConfirm ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {recoveryStatus && (
                    <p
                      className={`login__status${
                        isRecoveryDone ? ' login__status--success' : ''
                      }`}
                    >
                      {recoveryStatus}
                    </p>
                  )}

                  <div className="login__recovery-actions">
                    <button
                      className="button button--primary button--sm"
                      type="submit"
                      disabled={isRecoveryVerify && recoveryVerifying}
                    >
                      {isRecoveryRequest
                        ? 'Enviar codigo'
                        : isRecoveryVerify
                          ? recoveryVerifying
                            ? 'Validando...'
                            : 'Validar codigo'
                          : isRecoveryReset
                            ? 'Atualizar senha'
                            : 'Voltar para login'}
                    </button>
                    {!isRecoveryDone && (
                      <button
                        className="button button--ghost button--sm"
                        type="button"
                        onClick={closeRecovery}
                      >
                        Voltar
                      </button>
                    )}
                  </div>
                </div>
              )}
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
