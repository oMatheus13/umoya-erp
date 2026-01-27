import { useState, type FormEvent } from 'react'
import logotipo from '../assets/brand/logotipo.svg'
import { dataService } from '../services/dataService'
import { isSupabaseEnabled, supabase } from '../services/supabaseClient'
import type { User } from '@supabase/supabase-js'

type LoginProps = {
  onLogin: (user: User) => void
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

const Login = ({ onLogin }: LoginProps) => {
  const [status, setStatus] = useState<string | null>(null)
  const [loginForm, setLoginForm] = useState<LoginForm>(createEmptyLogin())

  const updateLoginForm = (patch: Partial<LoginForm>) => {
    setLoginForm((prev) => ({ ...prev, ...patch }))
  }

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!loginForm.identifier.trim() || !loginForm.password.trim()) {
      setStatus('Informe email ou CPF e senha.')
      return
    }

    if (!supabase) {
      setStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return
    }
    const identifier = loginForm.identifier.trim()
    let normalizedEmail = ''
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
        setStatus('CPF nao encontrado neste dispositivo. Use o email de acesso.')
        return
      }
      normalizedEmail = normalizeEmail(matchedUser.email)
    }
    supabase.auth
      .signInWithPassword({ email: normalizedEmail, password: loginForm.password })
      .then(({ data, error }) => {
        if (error) {
          setStatus(error.message)
          return
        }
        if (!data.user) {
          setStatus('Nao foi possivel autenticar.')
          return
        }
        setStatus(null)
        onLogin(data.user)
      })
  }

  return (
    <div className="login">
      <div className="login__panel">
        <img className="login__logo" src={logotipo} alt="Umoya ERP" />
        <h1 className="login__title">Bem-vindo ao Umoya ERP</h1>
        <p className="login__subtitle">
          Controle pedidos, producao e financeiro com uma visao clara do seu negocio.
        </p>

        {status && <p className="login__status">{status}</p>}

        {!isSupabaseEnabled() ? (
          <p className="login__status">
            Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no arquivo `.env` para
            ativar login.
          </p>
        ) : (
          <form className="login__form" onSubmit={handleLoginSubmit}>
            <label className="form__label" htmlFor="login-identifier">
              Email ou CPF
            </label>
            <input
              id="login-identifier"
              className="form__input"
              type="text"
              value={loginForm.identifier}
              onChange={(event) => updateLoginForm({ identifier: event.target.value })}
              placeholder="voce@umoya.com ou 000.000.000-00"
            />

            <label className="form__label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              className="form__input"
              type="password"
              value={loginForm.password}
              onChange={(event) => updateLoginForm({ password: event.target.value })}
              placeholder="••••••••"
            />

            <button className="button button--primary" type="submit">
              Entrar
            </button>
            <p className="login__hint">
              Contas de acesso sao criadas pelo administrador. Use email ou CPF cadastrado.
            </p>
          </form>
        )}
      </div>

      <aside className="login__aside">
        <div className="login__mock" aria-hidden="true">
          <div className="login__mock-card login__mock-card--primary">
            <div className="login__mock-header">
              <span>Visao geral</span>
              <span>Hoje</span>
            </div>
            <div className="login__mock-metrics">
              <div className="login__mock-metric">
                <span>Caixa</span>
                <strong>R$ 86.450</strong>
              </div>
              <div className="login__mock-metric">
                <span>Pedidos</span>
                <strong>18</strong>
              </div>
              <div className="login__mock-metric">
                <span>Producao</span>
                <strong>7 ordens</strong>
              </div>
            </div>
            <div className="login__mock-chart">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="login__mock-card login__mock-card--secondary">
            <div className="login__mock-header">
              <span>Financeiro</span>
              <span>Semana</span>
            </div>
            <div className="login__mock-lines">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <div className="login__card">
          <span className="login__tag">Visao rapida</span>
          <h2>Seu negocio em tempo real</h2>
          <p>
            Acompanhe producao, caixa e pedidos sem abrir planilhas. Tudo em um painel
            limpo e objetivo.
          </p>
        </div>
        <div className="login__stats">
          <div className="login__stat">
            <span className="login__stat-label">Pedidos no mes</span>
            <strong>128</strong>
          </div>
          <div className="login__stat">
            <span className="login__stat-label">Producao ativa</span>
            <strong>9 ordens</strong>
          </div>
          <div className="login__stat">
            <span className="login__stat-label">Saldo em caixa</span>
            <strong>R$ 86.450</strong>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default Login
