import type { EmployeeRole, PermissionKey, PermissionLevel, RolePermissions, UserAccount } from '../types/erp'
import type { ERPData } from '../types/erp'
import { ALL_PERMISSION_KEYS } from '../data/permissions'

export type PermissionCheck = {
  role?: EmployeeRole
  hasCustomPermissions: boolean
  canView: (key: PermissionKey) => boolean
  canEdit: (key: PermissionKey) => boolean
  resolveLevel: (key: PermissionKey) => PermissionLevel
}

const hasCustomPermissions = (permissions?: RolePermissions) =>
  !!permissions && Object.keys(permissions).length > 0

export const resolveRoleForUser = (data: ERPData, user: UserAccount | null) => {
  if (!user?.employeeId) {
    return undefined
  }
  const employee = data.funcionarios.find((item) => item.id === user.employeeId)
  if (!employee?.roleId) {
    return undefined
  }
  return data.cargos.find((role) => role.id === employee.roleId)
}

export const buildPermissionMap = (permissions?: RolePermissions) => {
  if (!hasCustomPermissions(permissions)) {
    return null
  }
  return ALL_PERMISSION_KEYS.reduce<RolePermissions>((acc, key) => {
    acc[key] = permissions?.[key] ?? 'none'
    return acc
  }, {})
}

export const createPermissionCheck = (data: ERPData, user: UserAccount | null): PermissionCheck => {
  if (!user) {
    return {
      hasCustomPermissions: false,
      canView: () => false,
      canEdit: () => false,
      resolveLevel: () => 'none',
    }
  }
  if (user.role === 'admin') {
    return {
      hasCustomPermissions: true,
      canView: () => true,
      canEdit: () => true,
      resolveLevel: () => 'edit',
    }
  }
  const role = resolveRoleForUser(data, user)
  if (!role) {
    return {
      role: undefined,
      hasCustomPermissions: false,
      canView: () => false,
      canEdit: () => false,
      resolveLevel: () => 'none',
    }
  }
  const permissions = buildPermissionMap(role?.permissions)
  const hasCustom = hasCustomPermissions(role?.permissions)
  const resolveLevel = (key: PermissionKey) =>
    permissions ? permissions[key] ?? 'none' : 'edit'
  const canView = (key: PermissionKey) => {
    const level = resolveLevel(key)
    return level === 'view' || level === 'edit'
  }
  const canEdit = (key: PermissionKey) => resolveLevel(key) === 'edit'
  return { role, hasCustomPermissions: hasCustom, canView, canEdit, resolveLevel }
}
