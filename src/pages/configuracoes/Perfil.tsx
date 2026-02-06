import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Placeholder from '../shared/Placeholder'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { UserAccount } from '../../types/erp'
import { supabase } from '../../services/supabaseClient'
import { erpRemote } from '../../services/erpRemote'
import { createSignedAvatarUrl, uploadAvatar } from '../../services/storageFiles'

const avatarOptions = [
  { value: 'lime', label: 'Lima', color: 'var(--color-lime)' },
  { value: 'ink', label: 'Ink', color: 'var(--color-ink)' },
  { value: 'sand', label: 'Sand', color: '#d9d3c7' },
  { value: 'night', label: 'Night', color: '#1b1f2a' },
]

const MAX_AVATAR_BYTES = 240 * 1024
const MAX_AVATAR_DIMENSION = 512
const AVATAR_QUALITY = 0.75

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
  avatarPath: string
}

const estimateDataUrlSize = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.round((base64.length * 3) / 4)
}

const downscaleImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      const maxSide = Math.max(image.width, image.height)
      const scale = maxSide > MAX_AVATAR_DIMENSION ? MAX_AVATAR_DIMENSION / maxSide : 1
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Falha ao processar a imagem.'))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', AVATAR_QUALITY)
      URL.revokeObjectURL(objectUrl)
      resolve(dataUrl)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Falha ao carregar a imagem.'))
    }
    image.src = objectUrl
  })

const Perfil = ({ currentUser, onUpdate }: PerfilProps) => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [form, setForm] = useState<PerfilForm>({
    displayName: '',
    name: '',
    phone: '',
    avatarColor: avatarOptions[0].value,
    avatarUrl: '',
    avatarPath: '',
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
      avatarPath: resolvedUser.avatarPath ?? '',
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
      avatarPath: form.avatarPath || undefined,
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
    let authError: string | null = null
    if (supabase) {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: nextUser.name,
          displayName: nextUser.displayName,
          cpf: nextUser.cpf,
          role: nextUser.role,
          phone: nextUser.phone,
          avatarColor: nextUser.avatarColor,
          avatarPath: nextUser.avatarPath,
        },
      })
      if (error) {
        message = 'Perfil salvo localmente, mas nao foi possivel atualizar o login.'
        authError = error.message
      }
    }
    const syncId = data.meta?.workspaceId ?? resolvedUser.id
    const remoteResult = await erpRemote.upsertState(syncId, dataService.getAll())
    if (authError) {
      message = `${message} (${authError})`
    }
    if (remoteResult.error) {
      message = `${message} Falha ao salvar no servidor (${remoteResult.error}).`
    }
    setStatus(message)
  }

  const avatarColor =
    avatarOptions.find((option) => option.value === form.avatarColor)?.color ??
    avatarOptions[0].color

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      setStatus('Selecione um arquivo de imagem valido.')
      return
    }
    if (!supabase) {
      setStatus('Supabase nao configurado. Verifique as variaveis de ambiente.')
      return
    }
    try {
      const dataUrl = await downscaleImage(file)
      if (estimateDataUrlSize(dataUrl) > MAX_AVATAR_BYTES) {
        setStatus('Imagem muito grande para sincronizar. Use uma foto menor.')
        return
      }
      const blob = await (await fetch(dataUrl)).blob()
      const uploadResult = await uploadAvatar(resolvedUser.id, blob)
      if (uploadResult.error || !uploadResult.path) {
        setStatus(`Falha ao enviar imagem. ${uploadResult.error ?? ''}`.trim())
        return
      }
      const signed = await createSignedAvatarUrl(uploadResult.path)
      if (!signed.url) {
        setStatus(`Falha ao gerar link da imagem. ${signed.error ?? ''}`.trim())
        return
      }
      updateForm({ avatarUrl: signed.url, avatarPath: uploadResult.path })
      setStatus(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao processar a imagem.'
      setStatus(message)
    }
  }

  return (
    <Page className="perfil">
      <PageHeader />

      {status && <p className="form__status">{status}</p>}

      <div className="grid grid--profile">
        <section className="card card--profile">
          <div className="card__row">
            <div className="ui-avatar" style={{ background: avatarColor }}>
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt={resolvedUser.name} />
              ) : (
                resolvedUser.name?.[0] ?? 'U'
              )}
            </div>
            <div className="card__stack">
              <h2 className="card__title">{resolvedUser.displayName || resolvedUser.name}</h2>
              <p className="card__meta">{resolvedUser.email}</p>
              <span
                className={`badge ${resolvedUser.role === 'admin' ? 'badge--aprovado' : 'badge--rascunho'}`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
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
    </Page>
  )
}

export default Perfil
