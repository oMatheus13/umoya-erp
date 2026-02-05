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

      <div className="usuarios-permissoes__summary summary-card">
        <article className="usuarios-permissoes__stat">
          <span className="usuarios-permissoes__stat-label">Cargos cadastrados</span>
          <strong className="usuarios-permissoes__stat-value">{roles.length}</strong>
        </article>
        <article className="usuarios-permissoes__stat">
          <span className="usuarios-permissoes__stat-label">Cargos com controle</span>
          <strong className="usuarios-permissoes__stat-value">
            {roles.filter((role) => role.permissions && Object.keys(role.permissions).length > 0).length}
          </strong>
        </article>
        <article className="usuarios-permissoes__stat">
          <span className="usuarios-permissoes__stat-label">Equipe total</span>
          <strong className="usuarios-permissoes__stat-value">{data.funcionarios.length}</strong>
        </article>
      </div>

      {roles.length === 0 ? (
        <section className="usuarios-permissoes__panel">
          <div className="usuarios-permissoes__panel-header">
            <div>
              <h2>Nenhum cargo encontrado</h2>
              <p>Cadastre cargos em RH &gt; Funcionarios para liberar o controle.</p>
            </div>
          </div>
        </section>
      ) : (
        <div className="usuarios-permissoes__layout">
          <aside className="usuarios-permissoes__panel usuarios-permissoes__roles">
            <div className="usuarios-permissoes__panel-header">
              <div>
                <h2>Cargos</h2>
                <p>Selecione um cargo para editar as permissoes.</p>
              </div>
            </div>
            <div className="usuarios-permissoes__role-list">
              {roles.map((role) => {
                const isActive = role.id === selectedRoleId
                const totalEmployees = roleUsage[role.id] ?? 0
                const isControlled = role.permissions && Object.keys(role.permissions).length > 0
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`usuarios-permissoes__role${isActive ? ' usuarios-permissoes__role--active' : ''}`}
                    onClick={() => setSelectedRoleId(role.id)}
                  >
                    <div>
                      <span className="usuarios-permissoes__role-name">{role.name}</span>
                      <span className="usuarios-permissoes__role-meta">
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
          </aside>

          <section className="usuarios-permissoes__panel usuarios-permissoes__permissions">
            <div className="usuarios-permissoes__panel-header">
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

            <div className="usuarios-permissoes__groups">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.id} className="usuarios-permissoes__group">
                  <div className="usuarios-permissoes__group-header">
                    <h3>{group.label}</h3>
                    <span>{group.items.length} itens</span>
                  </div>
                  <div className="usuarios-permissoes__list">
                    {group.items.map((item) => (
                      <div key={item.key} className="usuarios-permissoes__row">
                        <div>
                          <span className="usuarios-permissoes__item-title">{item.label}</span>
                          <span className="usuarios-permissoes__item-key">{item.key}</span>
                        </div>
                        <select
                          className="form__input usuarios-permissoes__select"
                          value={resolvedPermissions[item.key]}
                          onChange={(event) =>
                            handlePermissionChange(item.key, event.target.value as PermissionLevel)
                          }
                        >
                          {PERMISSION_LEVELS.map((level) => (
                            <option key={level.value} value={level.value}>
                              {level.label}
                            </option>
                          ))}
                        </select>
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
