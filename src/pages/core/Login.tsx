import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import logotipo from '../../assets/brand/logotipo.svg'
import loginMockErp from '../../assets/brand/login-mock-3.webp'
import loginMockPdv from '../../assets/brand/login-mock-2.webp'
import QuickNotice from '../../components/QuickNotice'
import { dataService } from '../../services/dataService'
import {
  getAuthPersistence,
  getSupabaseClient,
  isSupabaseEnabled,
  setAuthPersistence,
  supabaseNoPersist,
} from '../../services/supabaseClient'
import { useERPData } from '../../store/appStore'
import type { Employee } from '../../types/erp'
import { resolveAppKind } from '../../utils/appContext'
import { resolveDeviceId, resolveDeviceInfo } from '../../utils/device'
import { createId } from '../../utils/ids'
import { verifyPin } from '../../utils/pin'
import { playBeep, startTone, stopTone } from '../../utils/sound'
import type { User } from '@supabase/supabase-js'

type LoginProps =
  | {
      variant?: 'credentials'
      onLogin: (user: User) => void
      onDevLogin?: () => void
      className?: string
      authMode?: AuthMode
    }
  | {
      variant: 'pin'
      onPinLogin: (employee: Employee) => void
      className?: string
      pinNotice?: string | null
      pinDisabled?: boolean
      onPinDevLogin?: () => void
      pinDevLabel?: string
      pinBeep?: boolean
      authMode?: AuthMode
    }

type AuthMode = 'default' | 'nopersist'

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
const MAX_PIN_LENGTH = 8
const MIN_PIN_LENGTH = 4
const MAX_ATTEMPTS = 5
const LOCK_MS = 30000
const LOCK_STORAGE_KEY = 'umoya_pop_lock'
const PIN_TONES: Record<string, number> = {
  '1': 262,
  '2': 294,
  '3': 330,
  '4': 349,
  '5': 392,
  '6': 440,
  '7': 494,
  '8': 523,
  '9': 587,
  '0': 659,
}
const PIN_TONE_OK = 784
const PIN_TONE_BACKSPACE = 196
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

const isEmployeeActive = (employee: Employee) =>
  employee.active !== false && employee.isActive !== false

const loadLockState = () => {
  if (typeof window === 'undefined') {
    return { attempts: 0, lockedUntil: null as number | null }
  }
  try {
    const raw = window.localStorage.getItem(LOCK_STORAGE_KEY)
    if (!raw) {
      return { attempts: 0, lockedUntil: null as number | null }
    }
    const parsed = JSON.parse(raw) as { attempts?: number; lockedUntil?: number }
    return {
      attempts: Number.isFinite(parsed.attempts) ? (parsed.attempts as number) : 0,
      lockedUntil: Number.isFinite(parsed.lockedUntil)
        ? (parsed.lockedUntil as number)
        : null,
    }
  } catch {
    return { attempts: 0, lockedUntil: null as number | null }
  }
}

const saveLockState = (attempts: number, lockedUntil: number | null) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(
      LOCK_STORAGE_KEY,
      JSON.stringify({ attempts, lockedUntil }),
    )
  } catch {
    // ignore
  }
}

const Login = (props: LoginProps) => {
  const isPin = props.variant === 'pin'
  const authMode = props.authMode ?? 'default'
  const allowRemember = authMode !== 'nopersist'
  const onLogin = 'onLogin' in props ? props.onLogin : undefined
  const onDevLogin = 'onDevLogin' in props ? props.onDevLogin : undefined
  const onPinLogin = 'onPinLogin' in props ? props.onPinLogin : undefined
  const onPinDevLogin = 'onPinDevLogin' in props ? props.onPinDevLogin : undefined
  const pinDevLabel = 'pinDevLabel' in props ? props.pinDevLabel ?? 'Dev' : 'Dev'
  const enablePinBeep = 'pinBeep' in props ? props.pinBeep ?? false : false
  const pinNotice = 'pinNotice' in props ? props.pinNotice ?? null : null
  const pinDisabled = 'pinDisabled' in props ? props.pinDisabled ?? false : false
  const rootClassName = ['login', props.className].filter(Boolean).join(' ')
  const { data } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [loginForm, setLoginForm] = useState<LoginForm>(createEmptyLogin())
  const [rememberMe, setRememberMe] = useState(() =>
    allowRemember ? getAuthPersistence() : false,
  )
  const [showPassword, setShowPassword] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinStatus, setPinStatus] = useState<string | null>(pinNotice)
  const [showPin, setShowPin] = useState(false)
  const [isVerifyingPin, setIsVerifyingPin] = useState(false)
  const { attempts: initialAttempts, lockedUntil: initialLockedUntil } = loadLockState()
  const [failedAttempts, setFailedAttempts] = useState(initialAttempts)
  const [lockedUntil, setLockedUntil] = useState<number | null>(initialLockedUntil)
  const lastPointerToneAtRef = useRef(0)
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
  const lockTickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [lockTick, setLockTick] = useState(0)
  const deviceIdRef = useRef(resolveDeviceId())
  const supabaseEnabled =
    authMode === 'nopersist' ? !!supabaseNoPersist : isSupabaseEnabled()
  const resolveAuthClient = () =>
    authMode === 'nopersist' ? supabaseNoPersist : getSupabaseClient()
  const recoveryToken = recoveryCode.join('')
  const appKind = resolveAppKind()
  const appLabel =
    appKind === 'pdv'
      ? 'PDV'
      : appKind === 'pop'
        ? 'POP'
        : appKind === 'ptc'
          ? 'PTC'
          : 'ERP'
  const appMock = appKind === 'pdv' ? loginMockPdv : loginMockErp
  const employeesWithPin = useMemo(
    () =>
      data.funcionarios
        .filter((employee) => isEmployeeActive(employee) && employee.pinHash)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.funcionarios],
  )
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil
  const lockSeconds = isLocked
    ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
    : 0

  const updateLoginForm = (patch: Partial<LoginForm>) => {
    setLoginForm((prev) => ({ ...prev, ...patch }))
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!loginForm.identifier.trim() || !loginForm.password.trim()) {
      setStatus('Informe email ou CPF e senha.')
      return
    }

    if (allowRemember) {
      setAuthPersistence(rememberMe)
    }
    const client = resolveAuthClient()
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
      if (!onLogin) {
        setStatus('Login indisponivel.')
        return
      }
      onLogin(data.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      setStatus(`Falha ao conectar no Supabase. ${message}`)
    }
  }

  const logPinAttempt = (success: boolean, employeeId?: string) => {
    const payload = dataService.getAll()
    const now = new Date().toISOString()
    payload.popPinAttempts = [
      ...payload.popPinAttempts,
      {
        id: createId(),
        employeeId,
        success,
        timestamp: now,
        deviceId: deviceIdRef.current,
        deviceInfo: resolveDeviceInfo(),
        createdAt: now,
      },
    ]
    dataService.replaceAll(payload)
  }

  const findEmployeeByPin = async (pin: string) => {
    for (const employee of employeesWithPin) {
      if (!employee.pinHash) {
        continue
      }
      if (await verifyPin(pin, employee.pinHash)) {
        return employee
      }
    }
    return null
  }

  const setPinFeedback = (message: string | null) => {
    setPinStatus(message)
  }

  const triggerPinBeep = (tone?: number) => {
    if (!enablePinBeep) {
      return
    }
    playBeep({ frequency: tone ?? 760, durationMs: 70, volume: 0.06 })
  }

  const canPlayPinTone = () =>
    enablePinBeep && !pinDisabled && !isLocked && !isVerifyingPin

  const startPinTone = (tone?: number) => {
    if (!canPlayPinTone()) {
      return
    }
    startTone({ frequency: tone ?? 760, volume: 0.06 })
  }

  const startDigitTone = (tone?: number) => {
    if (pinInput.length >= MAX_PIN_LENGTH) {
      return
    }
    startPinTone(tone)
  }

  const startBackspaceTone = (tone?: number) => {
    if (!pinInput) {
      return
    }
    startPinTone(tone)
  }

  const stopPinTone = () => {
    if (!enablePinBeep) {
      return
    }
    stopTone()
  }

  const stopPointerTone = () => {
    lastPointerToneAtRef.current = Date.now()
    stopPinTone()
  }

  const handlePinSubmit = async () => {
    if (!isPin || isVerifyingPin || pinDisabled) {
      return
    }
    if (isLocked) {
      setPinFeedback(`Bloqueado. Aguarde ${lockSeconds}s.`)
      return
    }
    if (pinInput.trim().length < MIN_PIN_LENGTH) {
      setPinFeedback('Informe o PIN.')
      return
    }
    setIsVerifyingPin(true)
    const employee = await findEmployeeByPin(pinInput.trim())
    if (!employee) {
      const nextAttempts = failedAttempts + 1
      setFailedAttempts(nextAttempts)
      logPinAttempt(false)
      setPinFeedback('PIN incorreto.')
      setPinInput('')
      if (nextAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCK_MS)
        setFailedAttempts(0)
      }
      setIsVerifyingPin(false)
      return
    }
    setFailedAttempts(0)
    setLockedUntil(null)
    logPinAttempt(true, employee.id)
    setPinInput('')
    setPinFeedback(null)
    setShowPin(false)
    onPinLogin?.(employee)
    setIsVerifyingPin(false)
  }

  const handleDigit = (value: string) => {
    if (isLocked || pinDisabled) {
      return
    }
    if (pinInput.length >= MAX_PIN_LENGTH) {
      return
    }
    setPinInput((prev) => prev + value)
    setPinFeedback(null)
  }

  const handleBackspace = () => {
    if (isLocked || pinDisabled) {
      return
    }
    if (!pinInput) {
      return
    }
    setPinInput((prev) => prev.slice(0, -1))
    setPinFeedback(null)
  }

  const handlePinFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pinDisabled) {
      return
    }
    if (Date.now() - lastPointerToneAtRef.current > 400) {
      triggerPinBeep(PIN_TONE_OK)
    }
    void handlePinSubmit()
  }

  const handlePinChange = (event: FormEvent<HTMLInputElement>) => {
    if (pinDisabled) {
      return
    }
    const next = event.currentTarget.value.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH)
    setPinInput(next)
    setPinFeedback(null)
  }

  useEffect(() => {
    if (!isPin || !pinNotice) {
      return
    }
    setPinFeedback(pinNotice)
  }, [isPin, pinNotice])

  useEffect(() => {
    if (!isPin) {
      return
    }
    if (pinDisabled || isLocked || isVerifyingPin) {
      stopPinTone()
    }
  }, [isPin, pinDisabled, isLocked, isVerifyingPin])

  useEffect(() => {
    return () => {
      stopPinTone()
    }
  }, [])

  useEffect(() => {
    if (!isPin) {
      return
    }
    saveLockState(failedAttempts, lockedUntil)
  }, [isPin, failedAttempts, lockedUntil])

  useEffect(() => {
    if (!isPin) {
      return
    }
    if (!lockedUntil) {
      if (lockTickerRef.current) {
        clearInterval(lockTickerRef.current)
        lockTickerRef.current = null
      }
      return
    }
    if (lockTickerRef.current) {
      return
    }
    lockTickerRef.current = setInterval(() => {
      setLockTick((value) => value + 1)
    }, 500)
    return () => {
      if (lockTickerRef.current) {
        clearInterval(lockTickerRef.current)
        lockTickerRef.current = null
      }
    }
  }, [isPin, lockedUntil])

  useEffect(() => {
    if (!isPin || !lockedUntil) {
      return
    }
    if (Date.now() >= lockedUntil) {
      setLockedUntil(null)
      setFailedAttempts(0)
      setPinFeedback(null)
    }
  }, [isPin, lockTick, lockedUntil])

  useEffect(() => {
    if (!isPin) {
      return
    }
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (isLocked) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) {
        return
      }
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return
      }
      if (/^\d$/.test(event.key)) {
        handleDigit(event.key)
        return
      }
      if (event.key === 'Backspace') {
        handleBackspace()
        return
      }
      if (event.key === 'Enter') {
        void handlePinSubmit()
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKey)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKey)
      }
    }
  }, [isPin, isLocked, handleBackspace, handleDigit, handlePinSubmit])

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
    const client = resolveAuthClient()
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
    const client = resolveAuthClient()
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
    const client = resolveAuthClient()
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

  const handleRecoveryCodeKeyDown = (
    index: number,
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
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

  const pinStatusMessage = pinStatus
  const showDevPinButton = isPin && !!onPinDevLogin
  const devPinDisabled = isVerifyingPin || isLocked

  return (
    <div className={rootClassName}>
      {isPin && (
        <QuickNotice message={pinStatusMessage} onClear={() => setPinFeedback(null)} />
      )}
      {!isPin && (
        <>
          <QuickNotice message={status} onClear={() => setStatus(null)} />
          <QuickNotice
            message={recoveryStatus}
            onClear={() => setRecoveryStatus(null)}
            slot={status ? 1 : 0}
          />
        </>
      )}
      <div className="login__panel">
        <div className="login__mock">
          <img src={appMock} alt="" />
        </div>

        <div className="login__auth">
          <div className="login__brand">
            <span className="login__app-badge">{appLabel}</span>
            <img className="login__logo" src={logotipo} alt={`Umoya ${appLabel}`} />
          </div>

          {isPin ? (
            <form className="login__form" onSubmit={handlePinFormSubmit}>
              <div className="login__password">
                <div className="login__field">
                  <input
                    className="form__input pop-pin-input"
                    type={showPin ? 'text' : 'password'}
                    value={pinInput}
                    onChange={handlePinChange}
                    placeholder="PIN"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={MAX_PIN_LENGTH}
                    disabled={pinDisabled}
                  />
                  <button
                    className="login__toggle"
                    type="button"
                    aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                    aria-pressed={showPin}
                    onClick={() => setShowPin((prev) => !prev)}
                    disabled={pinDisabled}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {showPin ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
              {!pinDisabled && employeesWithPin.length === 0 && (
                <p className="login__hint">Nenhum funcionario com PIN cadastrado.</p>
              )}
              <div className="pop-keypad pop-keypad--login">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    className="pop-key"
                    onClick={() => handleDigit(digit)}
                    onPointerDown={() => startDigitTone(PIN_TONES[digit])}
                    onPointerUp={stopPointerTone}
                    onPointerLeave={stopPointerTone}
                    onPointerCancel={stopPointerTone}
                    disabled={isVerifyingPin || isLocked || pinDisabled}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  className="pop-key pop-key--ghost"
                  onClick={handleBackspace}
                  onPointerDown={() => startBackspaceTone(PIN_TONE_BACKSPACE)}
                  onPointerUp={stopPointerTone}
                  onPointerLeave={stopPointerTone}
                  onPointerCancel={stopPointerTone}
                  disabled={isVerifyingPin || isLocked || pinDisabled}
                  aria-label="Apagar"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    backspace
                  </span>
                  <span className="sr-only">Apagar</span>
                </button>
                <button
                  type="button"
                  className="pop-key"
                  onClick={() => handleDigit('0')}
                  onPointerDown={() => startDigitTone(PIN_TONES['0'])}
                  onPointerUp={stopPointerTone}
                  onPointerLeave={stopPointerTone}
                  onPointerCancel={stopPointerTone}
                  disabled={isVerifyingPin || isLocked || pinDisabled}
                >
                  0
                </button>
                {showDevPinButton ? (
                  <button
                    type="button"
                    className="pop-key pop-key--primary pop-key--dev"
                    onClick={() => {
                      onPinDevLogin?.()
                    }}
                    onPointerDown={() => startPinTone(PIN_TONE_OK)}
                    onPointerUp={stopPointerTone}
                    onPointerLeave={stopPointerTone}
                    onPointerCancel={stopPointerTone}
                    disabled={devPinDisabled}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      science
                    </span>
                    <span>{pinDevLabel}</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="pop-key pop-key--primary"
                    onPointerDown={() => startPinTone(PIN_TONE_OK)}
                    onPointerUp={stopPointerTone}
                    onPointerLeave={stopPointerTone}
                    onPointerCancel={stopPointerTone}
                    disabled={isVerifyingPin || isLocked || pinDisabled}
                  >
                    ok
                  </button>
                )}
              </div>
            </form>
          ) : !supabaseEnabled ? (
            <QuickNotice
              message="Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no arquivo `.env` para ativar login."
              autoHideMs={0}
            />
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

                  <div className="login__actions">
                    {allowRemember && (
                      <label className="toggle login__remember" htmlFor="login-remember">
                        <input
                          id="login-remember"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(event) => setRememberMe(event.target.checked)}
                        />
                        <span className="toggle__track" aria-hidden="true">
                          <span className="toggle__thumb" />
                        </span>
                        <span className="toggle__label">Manter conectado</span>
                      </label>
                    )}

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

          {!isPin && !supabaseEnabled && onDevLogin && (
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
