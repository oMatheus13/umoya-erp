import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Placeholder from '../shared/Placeholder'
import { Page, PageHeader } from '@ui/components'
import QuickNotice from '@shared/components/QuickNotice'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import type { UserAccount } from '@shared/types/erp'
import { supabase } from '@shared/services/supabaseClient'
import { erpRemote } from '@shared/services/erpRemote'
import { createSignedAvatarUrl, uploadAvatar } from '@shared/services/storageFiles'
import { sanitizeAvatarUrl } from '@shared/utils/avatar'

const avatarOptions = [
  { value: 'lime', label: 'Lima', color: 'var(--color-lime)' },
  { value: 'ink', label: 'Ink', color: 'var(--color-ink)' },
  { value: 'sand', label: 'Sand', color: '#d9d3c7' },
  { value: 'night', label: 'Night', color: '#1b1f2a' },
]

const MAX_AVATAR_BYTES = 240 * 1024
const AVATAR_DIMENSION_STEPS = [512, 384, 256]
const AVATAR_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52]
const AVATAR_MIME_TYPES = ['image/webp', 'image/jpeg']

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

const loadImageFromFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Falha ao carregar a imagem.'))
    }
    image.src = objectUrl
  })

const renderToCanvas = (image: HTMLImageElement, maxDimension: number) => {
  const maxSide = Math.max(image.width, image.height)
  const scale = maxSide > maxDimension ? maxDimension / maxSide : 1
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Falha ao processar a imagem.')
  }
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })

const buildAvatarBlob = async (file: File) => {
  const image = await loadImageFromFile(file)
  let lastBlob: Blob | null = null

  for (const maxDimension of AVATAR_DIMENSION_STEPS) {
    const canvas = renderToCanvas(image, maxDimension)
    for (const mimeType of AVATAR_MIME_TYPES) {
      for (const quality of AVATAR_QUALITY_STEPS) {
        const blob = await canvasToBlob(canvas, mimeType, quality)
        if (!blob) {
          continue
        }
        lastBlob = blob
        if (blob.size <= MAX_AVATAR_BYTES) {
          return blob
        }
      }
    }
  }

  if (lastBlob && lastBlob.size <= MAX_AVATAR_BYTES) {
    return lastBlob
  }
  throw new Error('Imagem muito grande mesmo apos conversao. Use uma foto menor.')
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
    avatarPath: '',
  })
  const [isDirty, setIsDirty] = useState(false)
  const lastUserIdRef = useRef<string | null>(null)

  const resolvedUser = useMemo(() => {
    if (!currentUser) {
      return null
    }
    const stored = data.usuarios.find((user) => user.id === currentUser.id) ?? currentUser
    if (!stored.avatarUrl && currentUser.avatarUrl) {
      return { ...stored, avatarUrl: currentUser.avatarUrl }
    }
    return stored
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
    const resolvedId = resolvedUser.id
    const shouldForceReset =
      lastUserIdRef.current !== null && lastUserIdRef.current !== resolvedId
    if (isDirty && !shouldForceReset) {
      return
    }
    lastUserIdRef.current = resolvedId
    setIsDirty(false)
    setForm({
      displayName: resolvedUser.displayName ?? '',
      name: resolvedUser.name ?? '',
      phone: resolvedUser.phone ?? '',
      avatarColor: resolvedUser.avatarColor ?? avatarOptions[0].value,
      avatarUrl: sanitizeAvatarUrl(resolvedUser.avatarUrl) ?? '',
      avatarPath: resolvedUser.avatarPath ?? '',
    })
  }, [resolvedUser, isDirty])

  useEffect(() => {
    if (!resolvedUser?.avatarPath || form.avatarUrl) {
      return
    }
    let active = true
    createSignedAvatarUrl(resolvedUser.avatarPath).then((signed) => {
      if (!active) {
        return
      }
      if (signed.url) {
        updateForm({ avatarUrl: signed.url }, false)
      }
    })
    return () => {
      active = false
    }
  }, [form.avatarUrl, resolvedUser?.avatarPath])

  if (!resolvedUser) {
    return (
      <Placeholder
        title="Perfil indisponivel"
        description="Faca login para personalizar suas informacoes."
      />
    )
  }

  const updateForm = (patch: Partial<PerfilForm>, markDirty = true) => {
    setForm((prev) => ({ ...prev, ...patch }))
    if (markDirty) {
      setIsDirty(true)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe seu nome para atualizar o perfil.')
      return
    }

    const payload = dataService.getAll()
    const sanitizedAvatarUrl = sanitizeAvatarUrl(form.avatarUrl)
    const nextUser: UserAccount = {
      ...resolvedUser,
      displayName: form.displayName.trim() || undefined,
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      avatarColor: form.avatarColor || undefined,
      avatarUrl: sanitizedAvatarUrl,
      avatarPath: form.avatarPath || undefined,
    }
    const { avatarUrl: _avatarUrl, ...payloadUser } = nextUser

    if (payload.usuarios.some((user) => user.id === resolvedUser.id)) {
      payload.usuarios = payload.usuarios.map((user) =>
        user.id === resolvedUser.id ? payloadUser : user,
      )
    } else {
      payload.usuarios = [...payload.usuarios, payloadUser]
    }

    setIsDirty(false)
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
          avatarUrl: null,
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
      const blob = await buildAvatarBlob(file)
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

      <QuickNotice message={status} onClear={() => setStatus(null)} />

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
                  onClick={() => updateForm({ avatarUrl: '', avatarPath: '' })}
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
