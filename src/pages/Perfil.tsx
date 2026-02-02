import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Placeholder from './Placeholder'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { UserAccount } from '../types/erp'
import { supabase } from '../services/supabaseClient'

const avatarOptions = [
  { value: 'lime', label: 'Lima', color: 'var(--color-lime)' },
  { value: 'ink', label: 'Ink', color: 'var(--color-ink)' },
  { value: 'sand', label: 'Sand', color: '#d9d3c7' },
  { value: 'night', label: 'Night', color: '#1b1f2a' },
]

type PerfilProps = {
  currentUser?: UserAccount | null
  onUpdate?: (user: UserAccount) => void
}

type PerfilForm = {
  displayName: string
  name: string
  phone: string
  avatarColor: string
  avatarUrl: string
}

const Perfil = ({ currentUser, onUpdate }: PerfilProps) => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [form, setForm] = useState<PerfilForm>({
    displayName: '',
    name: '',
    phone: '',
    avatarColor: avatarOptions[0].value,
    avatarUrl: '',
  })

  const resolvedUser = useMemo(() => {
    if (!currentUser) {
      return null
    }
    return data.usuarios.find((user) => user.id === currentUser.id) ?? currentUser
  }, [currentUser, data.usuarios])

  const roleLabel = useMemo(() => {
    if (!resolvedUser) {
      return 'Equipe'
    }
    if (resolvedUser.employeeId) {
      const employee = data.funcionarios.find(
        (item) => item.id === resolvedUser.employeeId,
      )
      if (employee?.roleId) {
        return data.cargos.find((role) => role.id === employee.roleId)?.name ?? 'Equipe'
      }
    }
    return resolvedUser.role === 'admin' ? 'Administrador' : 'Funcionario'
  }, [data.cargos, data.funcionarios, resolvedUser])

  useEffect(() => {
    if (!resolvedUser) {
      return
    }
    setForm({
      displayName: resolvedUser.displayName ?? '',
      name: resolvedUser.name ?? '',
      phone: resolvedUser.phone ?? '',
      avatarColor: resolvedUser.avatarColor ?? avatarOptions[0].value,
      avatarUrl: resolvedUser.avatarUrl ?? '',
    })
  }, [resolvedUser])

  if (!resolvedUser) {
    return (
      <Placeholder
        title="Perfil indisponivel"
        description="Faca login para personalizar suas informacoes."
      />
    )
  }

  const updateForm = (patch: Partial<PerfilForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe seu nome para atualizar o perfil.')
      return
    }

    const payload = dataService.getAll()
    const nextUser: UserAccount = {
      ...resolvedUser,
      displayName: form.displayName.trim() || undefined,
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      avatarColor: form.avatarColor || undefined,
      avatarUrl: form.avatarUrl || undefined,
    }

    if (payload.usuarios.some((user) => user.id === resolvedUser.id)) {
      payload.usuarios = payload.usuarios.map((user) =>
        user.id === resolvedUser.id ? nextUser : user,
      )
    } else {
      payload.usuarios = [...payload.usuarios, nextUser]
    }

    dataService.replaceAll(payload)
    refresh()
    onUpdate?.(nextUser)
    let message = 'Perfil atualizado com sucesso.'
    if (supabase) {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: nextUser.name,
          displayName: nextUser.displayName,
          cpf: nextUser.cpf,
          role: nextUser.role,
          phone: nextUser.phone,
          avatarColor: nextUser.avatarColor,
          avatarUrl: nextUser.avatarUrl,
        },
      })
      if (error) {
        message = 'Perfil salvo localmente, mas nao foi possivel atualizar o login.'
      }
    }
    setStatus(message)
  }

  const avatarColor =
    avatarOptions.find((option) => option.value === form.avatarColor)?.color ??
    avatarOptions[0].color

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      setStatus('Selecione um arquivo de imagem valido.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateForm({ avatarUrl: reader.result as string })
      setStatus(null)
    }
    reader.readAsDataURL(file)
  }

  return (
    <section className="perfil">
      <header className="perfil__header">
        <div className="perfil__headline">
          <span className="perfil__eyebrow">Conta</span>
          <h1 className="perfil__title">Meu perfil</h1>
          <p className="perfil__subtitle">Atualize seus dados pessoais e o avatar do sistema.</p>
        </div>
      </header>

      {status && <p className="form__status">{status}</p>}

      <div className="perfil__layout">
        <section className="perfil__card">
          <div className="perfil__avatar" style={{ background: avatarColor }}>
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt={resolvedUser.name} />
            ) : (
              resolvedUser.name?.[0] ?? 'U'
            )}
          </div>
          <div>
            <h2>{resolvedUser.displayName || resolvedUser.name}</h2>
            <p>{resolvedUser.email}</p>
            <span
              className={`badge ${resolvedUser.role === 'admin' ? 'badge--aprovado' : 'badge--rascunho'}`}
            >
              {roleLabel}
            </span>
          </div>
        </section>

        <section className="perfil__panel">
          <div className="perfil__panel-header">
            <div>
              <h2>Dados do usuario</h2>
              <p>Edite informacoes que aparecem nos relatorios e no painel.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleSubmit}>
            <div className="form__group">
              <label className="form__label" htmlFor="profile-display-name">
                Nome de visualizacao
              </label>
              <input
                id="profile-display-name"
                className="form__input"
                type="text"
                value={form.displayName}
                onChange={(event) => updateForm({ displayName: event.target.value })}
                placeholder="Ex: Kaua"
              />
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="profile-name">
                Nome completo
              </label>
              <input
                id="profile-name"
                className="form__input"
                type="text"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
              />
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="profile-email">
                  Email de acesso
                </label>
                <input
                  id="profile-email"
                  className="form__input"
                  type="email"
                  value={resolvedUser.email}
                  disabled
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="profile-phone">
                  Telefone
                </label>
                <input
                  id="profile-phone"
                  className="form__input"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateForm({ phone: event.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="profile-cpf">
                CPF
              </label>
              <input
                id="profile-cpf"
                className="form__input"
                type="text"
                value={resolvedUser.cpf ?? ''}
                disabled
                placeholder="Nao informado"
              />
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="profile-avatar">
                Cor do avatar
              </label>
              <select
                id="profile-avatar"
                className="form__input"
                value={form.avatarColor}
                onChange={(event) => updateForm({ avatarColor: event.target.value })}
              >
                {avatarOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="profile-photo">
                Foto do perfil
              </label>
              <input
                id="profile-photo"
                className="form__input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
              />
              {form.avatarUrl && (
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => updateForm({ avatarUrl: '' })}
                >
                  Remover foto
                </button>
              )}
            </div>

            <div className="form__actions">
              <button className="button button--primary" type="submit">
                Salvar perfil
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  )
}

export default Perfil
