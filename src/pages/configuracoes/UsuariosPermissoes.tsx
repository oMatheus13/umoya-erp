import { useEffect, useMemo, useState } from 'react'
import Placeholder from '../shared/Placeholder'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { PermissionKey, PermissionLevel, RolePermissions, UserAccount } from '../../types/erp'
import { ALL_PERMISSION_KEYS, PERMISSION_GROUPS, PERMISSION_LEVELS } from '../../data/permissions'
import { buildPermissionMap } from '../../utils/permissions'

const buildPreset = (level: PermissionLevel): RolePermissions =>
  ALL_PERMISSION_KEYS.reduce<RolePermissions>((acc, key) => {
    acc[key] = level
    return acc
  }, {})

type UsuariosPermissoesProps = {
  currentUser?: UserAccount | null
  onPermissionsChange?: () => void
}

const UsuariosPermissoes = ({ currentUser, onPermissionsChange }: UsuariosPermissoesProps) => {
  const { data, refresh } = useERPData()
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [status, setStatus] = useState<string | null>(null)

  const roles = useMemo(
    () => [...data.cargos].sort((a, b) => a.name.localeCompare(b.name)),
    [data.cargos],
  )

  useEffect(() => {
    if (roles.length === 0) {
      setSelectedRoleId('')
      return
    }
    if (!selectedRoleId || !roles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(roles[0].id)
    }
  }, [roles, selectedRoleId])

  useEffect(() => {
    setStatus(null)
  }, [selectedRoleId])

  const roleUsage = useMemo(() => {
    return data.funcionarios.reduce<Record<string, number>>((acc, employee) => {
      if (employee.roleId) {
        acc[employee.roleId] = (acc[employee.roleId] ?? 0) + 1
      }
      return acc
    }, {})
  }, [data.funcionarios])

  const selectedRole = roles.find((role) => role.id === selectedRoleId)
  const hasCustomPermissions =
    !!selectedRole?.permissions && Object.keys(selectedRole.permissions).length > 0
  const resolvedPermissions = selectedRole
    ? buildPermissionMap(selectedRole.permissions) ?? buildPreset('edit')
    : buildPreset('edit')

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <Placeholder
        title="Acesso restrito"
        description="Somente administradores podem alterar permissoes do sistema."
      />
    )
  }

  const updateRolePermissions = (roleId: string, permissions?: RolePermissions) => {
    const payload = dataService.getAll()
    payload.cargos = payload.cargos.map((role) =>
      role.id === roleId ? { ...role, permissions } : role,
    )
    dataService.replaceAll(payload)
    refresh()
    onPermissionsChange?.()
  }

  const handlePermissionChange = (key: PermissionKey, level: PermissionLevel) => {
    if (!selectedRole) {
      return
    }
    const nextPermissions = { ...resolvedPermissions, [key]: level }
    updateRolePermissions(selectedRole.id, nextPermissions)
    setStatus('Permissoes atualizadas.')
  }

  const applyPreset = (level: PermissionLevel) => {
    if (!selectedRole) {
      return
    }
    updateRolePermissions(selectedRole.id, buildPreset(level))
    setStatus('Permissoes atualizadas.')
  }

  const clearPermissions = () => {
    if (!selectedRole) {
      return
    }
    updateRolePermissions(selectedRole.id, undefined)
    setStatus('Controle removido. Este cargo tem acesso total.')
  }

  return (
    <Page className="usuarios-permissoes">
      <PageHeader
        actions={
          <>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => applyPreset('view')}
            >
              <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
                visibility
              </span>
              <span className="page-header__action-label">Somente leitura</span>
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => applyPreset('none')}
            >
              <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
                block
              </span>
              <span className="page-header__action-label">Sem acesso</span>
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => applyPreset('edit')}
            >
              <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
                lock_open
              </span>
              <span className="page-header__action-label">Liberar tudo</span>
            </button>
          </>
        }
      />

      {status && <p className="form__status">{status}</p>}

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Cargos cadastrados</span>
          <strong className="summary__value">{roles.length}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Cargos com controle</span>
          <strong className="summary__value">
            {roles.filter((role) => role.permissions && Object.keys(role.permissions).length > 0).length}
          </strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Equipe total</span>
          <strong className="summary__value">{data.funcionarios.length}</strong>
        </article>
      </div>

      {roles.length === 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Nenhum cargo encontrado</h2>
              <p>Cadastre cargos em RH &gt; Funcionarios para liberar o controle.</p>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid grid--two">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Cargos</h2>
                <p>Selecione um cargo para editar as permissoes.</p>
              </div>
            </div>
            <div className="list">
              {roles.map((role) => {
                const isActive = role.id === selectedRoleId
                const totalEmployees = roleUsage[role.id] ?? 0
                const isControlled = role.permissions && Object.keys(role.permissions).length > 0
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`list__item list__item--button${isActive ? ' list__item--active' : ''}`}
                    onClick={() => setSelectedRoleId(role.id)}
                    aria-pressed={isActive}
                  >
                    <div>
                      <strong>{role.name}</strong>
                      <span className="list__meta">
                        {totalEmployees} funcionarios · {role.multiplier.toFixed(2)}x
                      </span>
                    </div>
                    <span
                      className={`badge ${isControlled ? 'badge--aprovado' : 'badge--rascunho'}`}
                    >
                      {isControlled ? 'Controlado' : 'Acesso total'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Permissoes do cargo</h2>
                <p>
                  {selectedRole?.name ?? 'Cargo'} ·{' '}
                  {hasCustomPermissions ? 'Controle personalizado' : 'Acesso total (sem regras)'}
                </p>
              </div>
              <button className="button button--ghost" type="button" onClick={clearPermissions}>
                Remover controle
              </button>
            </div>

            <div className="panel__body">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.id} className="panel__section">
                  <div className="panel__section-header">
                    <h3 className="panel__section-title">{group.label}</h3>
                    <span className="panel__meta">{group.items.length} itens</span>
                  </div>
                  <div className="list list--compact">
                    {group.items.map((item) => (
                      <div key={item.key} className="list__item">
                        <div>
                          <strong>{item.label}</strong>
                          <span className="list__meta">{item.key}</span>
                        </div>
                        <div className="list__actions">
                          <select
                            className="form__input"
                            value={resolvedPermissions[item.key]}
                            onChange={(event) =>
                              handlePermissionChange(
                                item.key,
                                event.target.value as PermissionLevel,
                              )
                            }
                          >
                            {PERMISSION_LEVELS.map((level) => (
                              <option key={level.value} value={level.value}>
                                {level.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Page>
  )
}

export default UsuariosPermissoes
