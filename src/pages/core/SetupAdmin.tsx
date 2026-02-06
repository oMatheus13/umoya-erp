import { useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import logotipo from '../../assets/brand/logotipo.svg'
import loginMock from '../../assets/brand/login-mock-3.webp'
import { supabase } from '../../services/supabaseClient'

type SetupAdminProps = {
  onComplete: (user: User) => void
}

type SetupForm = {
  name: string
  email: string
  password: string
  confirm: string
}

const createEmptyForm = (): SetupForm => ({
  name: '',
  email: '',
  password: '',
  confirm: '',
})

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const SetupAdmin = ({ onComplete }: SetupAdminProps) => {
  const [form, setForm] = useState<SetupForm>(createEmptyForm())
  const [status, setStatus] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const updateForm = (patch: Partial<SetupForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe seu nome para criar a conta.')
      return
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setStatus('Informe um email valido.')
      return
    }
    if (!form.password.trim() || form.password.length < 6) {
      setStatus('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (form.password !== form.confirm) {
      setStatus('As senhas nao conferem.')
      return
    }
    if (!supabase) {
      setStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizeEmail(form.email),
        password: form.password,
        options: {
          data: {
            name: form.name.trim(),
            role: 'admin',
          },
        },
      })
      if (error) {
        setStatus(error.message)
        return
      }
      if (!data.user) {
        setStatus('Nao foi possivel criar a conta.')
        return
      }
      if (!data.session) {
        setStatus('Conta criada. Confirme o email para liberar o acesso.')
        return
      }
      if (!data.user.user_metadata?.workspace_id) {
        void supabase.auth.updateUser({ data: { workspace_id: data.user.id } })
      }
      setStatus(null)
      onComplete(data.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      setStatus(`Falha ao conectar no Supabase. ${message}`)
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

          <form className="login__form" onSubmit={handleSubmit}>
            <input
              id="setup-name"
              className="form__input"
              type="text"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="Nome completo"
            />
            <input
              id="setup-email"
              className="form__input"
              type="email"
              value={form.email}
              onChange={(event) => updateForm({ email: event.target.value })}
              placeholder="Email do admin"
            />

            <div className="login__password">
              <div className="login__field">
                <input
                  id="setup-password"
                  className="form__input"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => updateForm({ password: event.target.value })}
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
            </div>

            <div className="login__password">
              <div className="login__field">
                <input
                  id="setup-confirm"
                  className="form__input"
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={(event) => updateForm({ confirm: event.target.value })}
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

            {status && <p className="login__status">{status}</p>}

            <div className="login__actions">
              <div className="login__buttons">
                <button
                  className="button button--primary button--sm login__button"
                  type="submit"
                >
                  Criar admin
                </button>
              </div>
            </div>

            <p className="login__hint">
              Este link cria o primeiro admin do sistema.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SetupAdmin
