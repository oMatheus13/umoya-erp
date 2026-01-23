import type { FormEvent } from 'react'
import logotipo from '../assets/brand/logotipo.svg'

type LoginProps = {
  onSubmit: () => void
}

const Login = ({ onSubmit }: LoginProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <div className="login">
      <div className="login__panel">
        <img className="login__logo" src={logotipo} alt="Umoya ERP" />
        <h1 className="login__title">Bem-vindo ao Umoya ERP</h1>
        <p className="login__subtitle">
          Controle pedidos, producao e financeiro com uma visao clara do seu negocio.
        </p>

        <form className="login__form" onSubmit={handleSubmit}>
          <label className="form__label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="form__input"
            type="email"
            placeholder="voce@umoya.com"
          />

          <label className="form__label" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            className="form__input"
            type="password"
            placeholder="••••••••"
          />

          <button className="button button--primary" type="submit">
            Entrar
          </button>
        </form>
      </div>

      <aside className="login__aside">
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
