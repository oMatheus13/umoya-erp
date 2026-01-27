import { useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { isSupabaseEnabled, supabaseNoPersist } from '../services/supabaseClient'
import { useERPData } from '../store/appStore'
import type { Employee, EmployeeLevel, EmployeeRole, UserAccount, WorkLog } from '../types/erp'
import { formatCurrency, formatDateShort } from '../utils/format'
import { createId } from '../utils/ids'

type EmployeeForm = {
  name: string
  roleId: string
  levelId: string
  cpf: string
  active: boolean
  hiredAt: string
}

type RoleForm = {
  name: string
  multiplier: number
}

type LevelForm = {
  name: string
  multiplier: number
}

type WorkLogForm = {
  employeeId: string
  productId: string
  variantId: string
  quantity: number
  workDate: string
}

type AccountForm = {
  cpf: string
  email: string
  password: string
  confirm: string
  role: 'admin' | 'funcionario'
}

const createEmptyEmployeeForm = (): EmployeeForm => ({
  name: '',
  roleId: '',
  levelId: '',
  cpf: '',
  active: true,
  hiredAt: new Date().toISOString().slice(0, 10),
})

const createEmptyRoleForm = (): RoleForm => ({
  name: '',
  multiplier: 1,
})

const createEmptyLevelForm = (): LevelForm => ({
  name: '',
  multiplier: 1,
})

const createEmptyWorkLogForm = (): WorkLogForm => ({
  employeeId: '',
  productId: '',
  variantId: '',
  quantity: 1,
  workDate: new Date().toISOString().slice(0, 10),
})

const createEmptyAccountForm = (): AccountForm => ({
  cpf: '',
  email: '',
  password: '',
  confirm: '',
  role: 'funcionario',
})

type FuncionariosProps = {
  currentUser?: UserAccount | null
}

const Funcionarios = ({ currentUser }: FuncionariosProps) => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null)
  const [logStatus, setLogStatus] = useState<string | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null)
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null)
  const [deleteLevelId, setDeleteLevelId] = useState<string | null>(null)
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null)
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(createEmptyEmployeeForm())
  const [roleForm, setRoleForm] = useState<RoleForm>(createEmptyRoleForm())
  const [levelForm, setLevelForm] = useState<LevelForm>(createEmptyLevelForm())
  const [logForm, setLogForm] = useState<WorkLogForm>(createEmptyWorkLogForm())
  const [accountForm, setAccountForm] = useState<AccountForm>(createEmptyAccountForm())
  const [accountStatus, setAccountStatus] = useState<string | null>(null)
  const [createAccess, setCreateAccess] = useState(false)

  const roles = useMemo(
    () => [...data.cargos].sort((a, b) => a.name.localeCompare(b.name)),
    [data.cargos],
  )
  const levels = useMemo(
    () => [...data.niveis].sort((a, b) => a.name.localeCompare(b.name)),
    [data.niveis],
  )
  const employees = useMemo(
    () => [...data.funcionarios].sort((a, b) => a.name.localeCompare(b.name)),
    [data.funcionarios],
  )
  const logs = useMemo(
    () =>
      [...data.apontamentos].sort((a, b) =>
        (b.workDate ?? b.createdAt).localeCompare(a.workDate ?? a.createdAt),
      ),
    [data.apontamentos],
  )

  const users = useMemo(
    () => [...data.usuarios].sort((a, b) => a.name.localeCompare(b.name)),
    [data.usuarios],
  )

  const isAdmin = currentUser?.role === 'admin'
  const hasEmployeeAccess = editingEmployeeId
    ? users.some((user) => user.employeeId === editingEmployeeId)
    : false
  const canCreateAccess = isAdmin && isSupabaseEnabled() && !!supabaseNoPersist

  const now = new Date()
  const isSameMonth = (value: string) => {
    const date = new Date(value)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }

  const monthLogs = logs.filter((log) => isSameMonth(log.workDate))
  const monthPay = monthLogs.reduce((acc, log) => acc + log.totalPay, 0)
  const monthQuantity = monthLogs.reduce((acc, log) => acc + log.quantity, 0)

  const updateEmployeeForm = (patch: Partial<EmployeeForm>) => {
    setEmployeeForm((prev) => ({ ...prev, ...patch }))
  }

  const updateRoleForm = (patch: Partial<RoleForm>) => {
    setRoleForm((prev) => ({ ...prev, ...patch }))
  }

  const updateLevelForm = (patch: Partial<LevelForm>) => {
    setLevelForm((prev) => ({ ...prev, ...patch }))
  }

  const updateLogForm = (patch: Partial<WorkLogForm>) => {
    setLogForm((prev) => ({ ...prev, ...patch }))
  }

  const updateAccountForm = (patch: Partial<AccountForm>) => {
    setAccountForm((prev) => ({ ...prev, ...patch }))
  }

  const resetEmployeeForm = () => {
    setEmployeeForm(createEmptyEmployeeForm())
    setEditingEmployeeId(null)
    setCreateAccess(false)
    setAccountStatus(null)
    setAccountForm(createEmptyAccountForm())
  }

  const resetRoleForm = () => {
    setRoleForm(createEmptyRoleForm())
    setEditingRoleId(null)
  }

  const resetLevelForm = () => {
    setLevelForm(createEmptyLevelForm())
    setEditingLevelId(null)
  }

  const resetLogForm = () => {
    setLogForm(createEmptyWorkLogForm())
    setEditingLogId(null)
  }


  const closeEmployeeModal = () => {
    setIsEmployeeModalOpen(false)
    setEmployeeStatus(null)
    resetEmployeeForm()
  }

  const closeRoleModal = () => {
    setIsRoleModalOpen(false)
    setStatus(null)
    resetRoleForm()
  }

  const closeLevelModal = () => {
    setIsLevelModalOpen(false)
    setStatus(null)
    resetLevelForm()
  }

  const closeLogModal = () => {
    setIsLogModalOpen(false)
    setLogStatus(null)
    resetLogForm()
  }

  const openEmployeeModal = () => {
    setEmployeeStatus(null)
    resetEmployeeForm()
    setIsEmployeeModalOpen(true)
  }

  const openRoleModal = () => {
    setStatus(null)
    resetRoleForm()
    setIsRoleModalOpen(true)
  }

  const openLevelModal = () => {
    setStatus(null)
    resetLevelForm()
    setIsLevelModalOpen(true)
  }

  const openLogModal = () => {
    setLogStatus(null)
    resetLogForm()
    setIsLogModalOpen(true)
  }

  const normalizeEmail = (value: string) => value.trim().toLowerCase()
  const normalizeCpf = (value: string) => value.replace(/\D/g, '')
  const buildCpfEmail = (cpf: string) => `${cpf}@umoya.cpf`

  const getRole = (id?: string) => roles.find((role) => role.id === id)
  const getLevel = (id?: string) => levels.find((level) => level.id === id)
  const getEmployee = (id: string) => employees.find((employee) => employee.id === id)
  const getProduct = (id: string) => data.produtos.find((product) => product.id === id)
  const getEmployeeName = (id?: string) => (id ? getEmployee(id)?.name ?? '-' : '-')
  const handleEmployeeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!employeeForm.name.trim()) {
      setEmployeeStatus('Informe o nome do funcionario.')
      return
    }

    const payload = dataService.getAll()
    const normalizedCpf = normalizeCpf(employeeForm.cpf)
    if (normalizedCpf && normalizedCpf.length !== 11) {
      setEmployeeStatus('O CPF deve ter 11 digitos.')
      return
    }
    if (
      normalizedCpf &&
      payload.funcionarios.some(
        (item) =>
          item.id !== editingEmployeeId && normalizeCpf(item.cpf ?? '') === normalizedCpf,
      )
    ) {
      setEmployeeStatus('CPF ja cadastrado para outro funcionario.')
      return
    }
    const next: Employee = {
      id: editingEmployeeId ?? createId(),
      name: employeeForm.name.trim(),
      roleId: employeeForm.roleId || undefined,
      levelId: employeeForm.levelId || undefined,
      cpf: normalizedCpf || undefined,
      active: employeeForm.active,
      hiredAt: employeeForm.hiredAt,
    }

    if (editingEmployeeId) {
      payload.funcionarios = payload.funcionarios.map((item) =>
        item.id === editingEmployeeId ? next : item,
      )
    } else {
      payload.funcionarios = [...payload.funcionarios, next]
    }
    payload.usuarios = payload.usuarios.map((user) =>
      user.employeeId === next.id
        ? {
            ...user,
            name: next.name,
            cpf: normalizedCpf || undefined,
          }
        : user,
    )

    dataService.replaceAll(payload)
    refresh()

    let accessMessage = ''
    if (
      createAccess &&
      isAdmin &&
      isSupabaseEnabled() &&
      supabaseNoPersist &&
      !users.some((user) => user.employeeId === next.id)
    ) {
      const normalizedEmail = accountForm.email.trim()
        ? normalizeEmail(accountForm.email)
        : ''
      const accountCpf = normalizeCpf(accountForm.cpf || employeeForm.cpf)
      if (!normalizedEmail && !accountCpf) {
        setAccountStatus('Informe email ou CPF para criar acesso.')
        return
      }
      if (accountCpf && accountCpf.length !== 11) {
        setAccountStatus('O CPF deve ter 11 digitos.')
        return
      }
      if (!accountForm.password.trim() || accountForm.password.length < 6) {
        setAccountStatus('A senha deve ter pelo menos 6 caracteres.')
        return
      }
      if (accountForm.password !== accountForm.confirm) {
        setAccountStatus('As senhas nao conferem.')
        return
      }
      if (normalizedEmail && users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
        setAccountStatus('Email ja cadastrado.')
        return
      }
      if (accountCpf && users.some((user) => normalizeCpf(user.cpf ?? '') === accountCpf)) {
        setAccountStatus('CPF ja cadastrado.')
        return
      }

      const authEmail = normalizedEmail || buildCpfEmail(accountCpf)

      const { data: signupData, error } = await supabaseNoPersist.auth.signUp({
        email: authEmail,
        password: accountForm.password,
        options: {
          data: {
            name: next.name,
            employeeId: next.id,
            role: accountForm.role,
            cpf: accountCpf || undefined,
          },
        },
      })

      if (error) {
        setAccountStatus(error.message)
        return
      }
      if (!signupData.user) {
        setAccountStatus('Nao foi possivel criar a conta.')
        return
      }

      const updated = dataService.getAll()
      updated.usuarios = [
        ...updated.usuarios,
        {
          id: signupData.user.id,
          employeeId: next.id,
          name: next.name,
          email: normalizedEmail || authEmail,
          cpf: accountCpf || undefined,
          role: accountForm.role,
          createdAt: new Date().toISOString(),
          active: true,
        },
      ]
      dataService.replaceAll(updated)
      refresh()
      accessMessage = ' Conta criada.'
    }

    setEmployeeStatus(
      `${editingEmployeeId ? 'Funcionario atualizado.' : 'Funcionario cadastrado.'}${accessMessage}`,
    )
    setIsEmployeeModalOpen(false)
    resetEmployeeForm()
  }

  const handleRoleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!roleForm.name.trim()) {
      setStatus('Informe o nome do cargo.')
      return
    }
    if (roleForm.multiplier <= 0) {
      setStatus('O multiplicador deve ser maior que zero.')
      return
    }

    const payload = dataService.getAll()
    const next: EmployeeRole = {
      id: editingRoleId ?? createId(),
      name: roleForm.name.trim(),
      multiplier: roleForm.multiplier,
    }

    if (editingRoleId) {
      payload.cargos = payload.cargos.map((item) => (item.id === editingRoleId ? next : item))
    } else {
      payload.cargos = [...payload.cargos, next]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingRoleId ? 'Cargo atualizado.' : 'Cargo cadastrado.')
    setIsRoleModalOpen(false)
    resetRoleForm()
  }

  const handleLevelSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!levelForm.name.trim()) {
      setStatus('Informe o nome do nivel.')
      return
    }
    if (levelForm.multiplier <= 0) {
      setStatus('O multiplicador deve ser maior que zero.')
      return
    }

    const payload = dataService.getAll()
    const next: EmployeeLevel = {
      id: editingLevelId ?? createId(),
      name: levelForm.name.trim(),
      multiplier: levelForm.multiplier,
    }

    if (editingLevelId) {
      payload.niveis = payload.niveis.map((item) => (item.id === editingLevelId ? next : item))
    } else {
      payload.niveis = [...payload.niveis, next]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingLevelId ? 'Nivel atualizado.' : 'Nivel cadastrado.')
    setIsLevelModalOpen(false)
    resetLevelForm()
  }

  const updateStock = (
    payload: ReturnType<typeof dataService.getAll>,
    productId: string,
    variantId: string | undefined,
    delta: number,
  ) => {
    const productIndex = payload.produtos.findIndex((product) => product.id === productId)
    if (productIndex < 0) {
      return false
    }
    const product = payload.produtos[productIndex]
    const variants = product.variants ?? []
    const targetId = variantId ?? variants[0]?.id
    if (!targetId) {
      return false
    }
    payload.produtos[productIndex] = {
      ...product,
      variants: variants.map((variant) =>
        variant.id === targetId ? { ...variant, stock: (variant.stock ?? 0) + delta } : variant,
      ),
    }
    return true
  }

  const handleLogSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!logForm.employeeId || !logForm.productId || !logForm.variantId) {
      setLogStatus('Selecione funcionario, produto e variacao.')
      return
    }
    if (logForm.quantity <= 0) {
      setLogStatus('Quantidade deve ser maior que zero.')
      return
    }

    const payload = dataService.getAll()
    const employee = payload.funcionarios.find((item) => item.id === logForm.employeeId)
    const product = payload.produtos.find((item) => item.id === logForm.productId)
    const variant = product?.variants?.find((item) => item.id === logForm.variantId)

    if (!employee || !product || !variant) {
      setLogStatus('Dados invalidos para o apontamento.')
      return
    }

    const roleMultiplier = getRole(employee.roleId)?.multiplier ?? 1
    const levelMultiplier = getLevel(employee.levelId)?.multiplier ?? 1
    const unitLaborCost = product.laborCost ?? 0
    if (unitLaborCost <= 0) {
      setLogStatus('Defina a mao de obra do produto antes de registrar a producao.')
      return
    }
    const laborBasis = product.laborBasis ?? 'unidade'
    let laborQuantity = logForm.quantity
    if (laborBasis === 'metro') {
      const length = variant?.length ?? product.length ?? 0
      if (length <= 0) {
        setLogStatus('Defina o comprimento da variacao ou do produto para calcular por metro.')
        return
      }
      laborQuantity = logForm.quantity * length
    }
    const totalPay = laborQuantity * unitLaborCost * roleMultiplier * levelMultiplier

    const existingLog = editingLogId
      ? payload.apontamentos.find((item) => item.id === editingLogId)
      : undefined

    const next: WorkLog = {
      id: existingLog?.id ?? createId(),
      employeeId: logForm.employeeId,
      productId: logForm.productId,
      variantId: logForm.variantId,
      quantity: logForm.quantity,
      workDate: logForm.workDate,
      createdAt: existingLog?.createdAt ?? new Date().toISOString(),
      unitLaborCost,
      roleMultiplier,
      levelMultiplier,
      totalPay,
    }

    if (existingLog) {
      payload.apontamentos = payload.apontamentos.map((item) =>
        item.id === next.id ? next : item,
      )

      if (existingLog.productId === next.productId && existingLog.variantId === next.variantId) {
        const delta = next.quantity - existingLog.quantity
        updateStock(payload, next.productId, next.variantId, delta)
      } else {
        updateStock(payload, existingLog.productId, existingLog.variantId, -existingLog.quantity)
        updateStock(payload, next.productId, next.variantId, next.quantity)
      }
    } else {
      payload.apontamentos = [...payload.apontamentos, next]
      updateStock(payload, next.productId, next.variantId, next.quantity)
    }

    dataService.replaceAll(payload)
    refresh()
    setLogStatus(existingLog ? 'Apontamento atualizado.' : 'Apontamento registrado.')
    setIsLogModalOpen(false)
    resetLogForm()
  }

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployeeId(employee.id)
    setEmployeeForm({
      name: employee.name,
      roleId: employee.roleId ?? '',
      levelId: employee.levelId ?? '',
      cpf: employee.cpf ?? '',
      active: employee.active ?? true,
      hiredAt: employee.hiredAt ?? new Date().toISOString().slice(0, 10),
    })
    setIsEmployeeModalOpen(true)
  }

  const handleEditRole = (role: EmployeeRole) => {
    setEditingRoleId(role.id)
    setRoleForm({
      name: role.name,
      multiplier: role.multiplier,
    })
    setIsRoleModalOpen(true)
  }

  const handleEditLevel = (level: EmployeeLevel) => {
    setEditingLevelId(level.id)
    setLevelForm({
      name: level.name,
      multiplier: level.multiplier,
    })
    setIsLevelModalOpen(true)
  }

  const handleEditLog = (log: WorkLog) => {
    setEditingLogId(log.id)
    setLogForm({
      employeeId: log.employeeId,
      productId: log.productId,
      variantId: log.variantId ?? '',
      quantity: log.quantity,
      workDate: log.workDate,
    })
    setIsLogModalOpen(true)
  }

  const handleDeleteEmployee = () => {
    if (!deleteEmployeeId) {
      return
    }
    const payload = dataService.getAll()
    payload.funcionarios = payload.funcionarios.filter((item) => item.id !== deleteEmployeeId)
    dataService.replaceAll(payload)
    refresh()
    setEmployeeStatus('Funcionario excluido.')
    setDeleteEmployeeId(null)
  }

  const handleDeleteRole = () => {
    if (!deleteRoleId) {
      return
    }
    const payload = dataService.getAll()
    payload.cargos = payload.cargos.filter((item) => item.id !== deleteRoleId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Cargo excluido.')
    setDeleteRoleId(null)
  }

  const handleDeleteLevel = () => {
    if (!deleteLevelId) {
      return
    }
    const payload = dataService.getAll()
    payload.niveis = payload.niveis.filter((item) => item.id !== deleteLevelId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Nivel excluido.')
    setDeleteLevelId(null)
  }

  const handleDeleteLog = () => {
    if (!deleteLogId) {
      return
    }
    const payload = dataService.getAll()
    const log = payload.apontamentos.find((item) => item.id === deleteLogId)
    if (log) {
      updateStock(payload, log.productId, log.variantId, -log.quantity)
    }
    payload.apontamentos = payload.apontamentos.filter((item) => item.id !== deleteLogId)
    dataService.replaceAll(payload)
    refresh()
    setLogStatus('Apontamento excluido.')
    setDeleteLogId(null)
  }

  const topEmployees = useMemo(() => {
    const totals = new Map<string, number>()
    monthLogs.forEach((log) => {
      totals.set(log.employeeId, (totals.get(log.employeeId) ?? 0) + log.totalPay)
    })
    return [...totals.entries()]
      .map(([employeeId, total]) => ({
        employeeId,
        total,
        name: getEmployee(employeeId)?.name ?? 'Funcionario',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
  }, [monthLogs, employees])

  const selectedLogProduct = logForm.productId ? getProduct(logForm.productId) : undefined
  const selectedLogVariant = selectedLogProduct?.variants?.find(
    (variant) => variant.id === logForm.variantId,
  )
  const selectedLaborBasis = selectedLogProduct?.laborBasis ?? 'unidade'
  const selectedLaborLength = selectedLogVariant?.length ?? selectedLogProduct?.length ?? 0

  return (
    <section className="funcionarios">
      <header className="funcionarios__header">
        <div className="funcionarios__headline">
          <span className="funcionarios__eyebrow">Operacao</span>
          <h1 className="funcionarios__title">Funcionarios</h1>
          <p className="funcionarios__subtitle">
            Registre producao diaria e calcule pagamentos automaticamente.
          </p>
        </div>
        <div className="funcionarios__actions">
          <button className="button button--ghost" type="button" onClick={openRoleModal}>
            Novo cargo
          </button>
          <button className="button button--ghost" type="button" onClick={openLevelModal}>
            Novo nivel
          </button>
          <button className="button button--primary" type="button" onClick={openEmployeeModal}>
            Novo funcionario
          </button>
          <button className="button button--primary" type="button" onClick={openLogModal}>
            Registrar producao
          </button>
        </div>
      </header>
      {employeeStatus && <p className="form__status">{employeeStatus}</p>}
      {logStatus && <p className="form__status">{logStatus}</p>}

      <div className="funcionarios__cards">
        <article className="card">
          <span className="card__label">Funcionarios ativos</span>
          <span className="card__value">
            {employees.filter((employee) => employee.active !== false).length}
          </span>
        </article>
        <article className="card">
          <span className="card__label">Producao do mes</span>
          <span className="card__value">{monthQuantity}</span>
        </article>
        <article className="card">
          <span className="card__label">Pagamento do mes</span>
          <span className="card__value">{formatCurrency(monthPay)}</span>
        </article>
      </div>

      <div className="funcionarios__grid">
        <section className="panel">
          <h2 className="panel__title">Ranking do mes</h2>
          <div className="list">
            {topEmployees.length === 0 && (
              <div className="list__item">
                <span>Nenhum apontamento registrado.</span>
                <strong>-</strong>
              </div>
            )}
            {topEmployees.map((entry) => (
              <div key={entry.employeeId} className="list__item">
                <span>{entry.name}</span>
                <strong>{formatCurrency(entry.total)}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 className="panel__title">Ultimos apontamentos</h2>
          <div className="list">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className="list__item">
                <span>{getEmployee(log.employeeId)?.name ?? 'Funcionario'}</span>
                <strong>{formatCurrency(log.totalPay)}</strong>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="list__item">
                <span>Nenhum apontamento ainda.</span>
                <strong>-</strong>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="funcionarios__layout">
        <div className="funcionarios__panel">
          <div className="funcionarios__panel-header">
            <div>
              <h2>Funcionarios</h2>
              <p>Equipe cadastrada e status ativo.</p>
            </div>
            <span className="funcionarios__panel-meta">{employees.length} registros</span>
          </div>
          <div className="table-card funcionarios__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Cargo</th>
                  <th>Nivel</th>
                  <th>Ativo</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table__empty">
                      Nenhum funcionario cadastrado ainda.
                    </td>
                  </tr>
                )}
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td>{employee.cpf ?? '-'}</td>
                    <td>{getRole(employee.roleId)?.name ?? '-'}</td>
                    <td>{getLevel(employee.levelId)?.name ?? '-'}</td>
                    <td>
                      <span
                        className={`badge ${
                          employee.active ? 'badge--aprovado' : 'badge--rascunho'
                        }`}
                      >
                        {employee.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="table__actions">
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => handleEditEmployee(employee)}
                      >
                        Editar
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => setDeleteEmployeeId(employee.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="funcionarios__panel">
          <div className="funcionarios__panel-header">
            <div>
              <h2>Apontamentos</h2>
              <p>Registros de producao e pagamentos.</p>
            </div>
            <span className="funcionarios__panel-meta">{logs.length} registros</span>
          </div>
          <div className="table-card funcionarios__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Funcionario</th>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Pagamento</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table__empty">
                      Nenhum apontamento registrado.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateShort(log.workDate)}</td>
                    <td>{getEmployee(log.employeeId)?.name ?? 'Funcionario'}</td>
                    <td>{getProduct(log.productId)?.name ?? 'Produto'}</td>
                    <td>
                      {log.quantity}
                      {getProduct(log.productId)?.unit ? ` ${getProduct(log.productId)?.unit}` : ''}
                    </td>
                    <td>{formatCurrency(log.totalPay)}</td>
                    <td className="table__actions">
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => handleEditLog(log)}
                      >
                        Editar
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => setDeleteLogId(log.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="funcionarios__grid">
        <section className="funcionarios__panel">
          <div className="funcionarios__panel-header">
            <div>
              <h2>Cargos</h2>
              <p>Multiplicadores aplicados a mao de obra.</p>
            </div>
            <span className="funcionarios__panel-meta">{roles.length} registros</span>
          </div>
          <div className="table-card funcionarios__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Multiplicador</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="table__empty">
                      Nenhum cargo cadastrado ainda.
                    </td>
                  </tr>
                )}
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>{role.name}</td>
                    <td>{role.multiplier.toFixed(2)}x</td>
                    <td className="table__actions">
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => handleEditRole(role)}
                      >
                        Editar
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => setDeleteRoleId(role.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="funcionarios__panel">
          <div className="funcionarios__panel-header">
            <div>
              <h2>Niveis</h2>
              <p>Ajuste por experiencia e desempenho.</p>
            </div>
            <span className="funcionarios__panel-meta">{levels.length} registros</span>
          </div>
          <div className="table-card funcionarios__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Multiplicador</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {levels.length === 0 && (
                  <tr>
                    <td colSpan={3} className="table__empty">
                      Nenhum nivel cadastrado ainda.
                    </td>
                  </tr>
                )}
                {levels.map((level) => (
                  <tr key={level.id}>
                    <td>{level.name}</td>
                    <td>{level.multiplier.toFixed(2)}x</td>
                    <td className="table__actions">
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => handleEditLevel(level)}
                      >
                        Editar
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => setDeleteLevelId(level.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="funcionarios__grid">
        <section className="funcionarios__panel">
          <div className="funcionarios__panel-header">
            <div>
              <h2>Contas de acesso</h2>
              <p>Perfis vinculados aos funcionarios.</p>
            </div>
            <span className="funcionarios__panel-meta">{users.length} registros</span>
          </div>
          <div className="table-card funcionarios__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>CPF</th>
                  <th>Perfil</th>
                  <th>Funcionario</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table__empty">
                      Nenhuma conta cadastrada ainda.
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.cpf ?? '-'}</td>
                    <td>
                      <span
                        className={`badge ${
                          user.role === 'admin' ? 'badge--aprovado' : 'badge--rascunho'
                        }`}
                      >
                        {user.role === 'admin' ? 'Admin' : 'Funcionario'}
                      </span>
                    </td>
                    <td>{getEmployeeName(user.employeeId)}</td>
                    <td>
                      <span
                        className={`badge ${
                          user.active === false ? 'badge--rascunho' : 'badge--aprovado'
                        }`}
                      >
                        {user.active === false ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      <Modal
        open={isEmployeeModalOpen}
        onClose={closeEmployeeModal}
        title={editingEmployeeId ? 'Editar funcionario' : 'Novo funcionario'}
        size="lg"
      >
        <form className="form" onSubmit={handleEmployeeSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="employee-name">
              Nome
            </label>
            <input
              id="employee-name"
              className="form__input"
              type="text"
              value={employeeForm.name}
              onChange={(event) => updateEmployeeForm({ name: event.target.value })}
              placeholder="Nome completo"
            />
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="employee-role">
                Cargo
              </label>
              <select
                id="employee-role"
                className="form__input"
                value={employeeForm.roleId}
                onChange={(event) => updateEmployeeForm({ roleId: event.target.value })}
              >
                <option value="">Selecione um cargo</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="employee-level">
                Nivel
              </label>
              <select
                id="employee-level"
                className="form__input"
                value={employeeForm.levelId}
                onChange={(event) => updateEmployeeForm({ levelId: event.target.value })}
              >
                <option value="">Selecione um nivel</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="employee-cpf">
                CPF
              </label>
              <input
                id="employee-cpf"
                className="form__input"
                type="text"
                inputMode="numeric"
                value={employeeForm.cpf}
                onChange={(event) => updateEmployeeForm({ cpf: event.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="employee-hired">
                Data de entrada
              </label>
              <input
                id="employee-hired"
                className="form__input"
                type="date"
                value={employeeForm.hiredAt}
                onChange={(event) => updateEmployeeForm({ hiredAt: event.target.value })}
              />
            </div>
          </div>

          <label className="form__checkbox">
            <input
              type="checkbox"
              checked={employeeForm.active}
              onChange={(event) => updateEmployeeForm({ active: event.target.checked })}
            />
            Funcionario ativo
          </label>

          {isAdmin && (
            <div className="form__section">
              <div className="form__group">
                <span className="form__label">Acesso ao sistema</span>
                {!isSupabaseEnabled() ? (
                  <p className="form__help">
                    Configure o Supabase para criar contas de acesso.
                  </p>
                ) : hasEmployeeAccess ? (
                  <p className="form__help">Este funcionario ja possui acesso.</p>
                ) : (
                  <label className="form__checkbox">
                    <input
                      type="checkbox"
                      checked={createAccess}
                      onChange={(event) => {
                        const next = event.target.checked
                        setCreateAccess(next)
                        if (!next) {
                          setAccountStatus(null)
                          setAccountForm(createEmptyAccountForm())
                          return
                        }
                        setAccountForm((prev) => ({
                          ...prev,
                          cpf: prev.cpf || employeeForm.cpf,
                        }))
                      }}
                    />
                    Criar acesso para este funcionario
                  </label>
                )}
              </div>

              {createAccess && canCreateAccess && !hasEmployeeAccess && (
                <>
                  <div className="form__group">
                    <label className="form__label" htmlFor="employee-access-cpf">
                      CPF de acesso
                    </label>
                    <input
                      id="employee-access-cpf"
                      className="form__input"
                      type="text"
                      inputMode="numeric"
                      value={accountForm.cpf}
                      onChange={(event) => updateAccountForm({ cpf: event.target.value })}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="form__row">
                    <div className="form__group">
                      <label className="form__label" htmlFor="employee-access-email">
                        Email de acesso
                      </label>
                      <input
                        id="employee-access-email"
                        className="form__input"
                        type="email"
                        value={accountForm.email}
                        onChange={(event) => updateAccountForm({ email: event.target.value })}
                        placeholder="email@empresa.com (opcional)"
                      />
                    </div>
                    <div className="form__group">
                      <label className="form__label" htmlFor="employee-access-role">
                        Perfil
                      </label>
                      <select
                        id="employee-access-role"
                        className="form__input"
                        value={accountForm.role}
                        onChange={(event) =>
                          updateAccountForm({
                            role: event.target.value as AccountForm['role'],
                          })
                        }
                      >
                        <option value="funcionario">Funcionario</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="form__row">
                    <div className="form__group">
                      <label className="form__label" htmlFor="employee-access-password">
                        Senha
                      </label>
                      <input
                        id="employee-access-password"
                        className="form__input"
                        type="password"
                        value={accountForm.password}
                        onChange={(event) => updateAccountForm({ password: event.target.value })}
                        placeholder="Minimo 6 caracteres"
                      />
                    </div>
                    <div className="form__group">
                      <label className="form__label" htmlFor="employee-access-confirm">
                        Confirmar senha
                      </label>
                      <input
                        id="employee-access-confirm"
                        className="form__input"
                        type="password"
                        value={accountForm.confirm}
                        onChange={(event) => updateAccountForm({ confirm: event.target.value })}
                        placeholder="Repita a senha"
                      />
                    </div>
                  </div>
                  {accountStatus && <p className="form__status">{accountStatus}</p>}
                </>
              )}
            </div>
          )}

          <div className="form__actions">
            <button className="button button--primary" type="submit">
              {editingEmployeeId ? 'Atualizar' : 'Salvar funcionario'}
            </button>
            <button className="button button--ghost" type="button" onClick={closeEmployeeModal}>
              Cancelar
            </button>
          </div>
          {employeeStatus && <p className="form__status">{employeeStatus}</p>}
        </form>
      </Modal>

      <Modal
        open={isRoleModalOpen}
        onClose={closeRoleModal}
        title={editingRoleId ? 'Editar cargo' : 'Novo cargo'}
        size="sm"
      >
        <form className="form" onSubmit={handleRoleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="role-name">
              Cargo
            </label>
            <input
              id="role-name"
              className="form__input"
              type="text"
              value={roleForm.name}
              onChange={(event) => updateRoleForm({ name: event.target.value })}
            />
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="role-multiplier">
              Multiplicador
            </label>
            <input
              id="role-multiplier"
              className="form__input"
              type="number"
              min="0.1"
              step="0.1"
              value={roleForm.multiplier}
              onChange={(event) => updateRoleForm({ multiplier: Number(event.target.value) })}
            />
          </div>
          <div className="form__actions">
            <button className="button button--primary" type="submit">
              {editingRoleId ? 'Atualizar' : 'Salvar cargo'}
            </button>
            <button className="button button--ghost" type="button" onClick={closeRoleModal}>
              Cancelar
            </button>
          </div>
          {status && <p className="form__status">{status}</p>}
        </form>
      </Modal>

      <Modal
        open={isLevelModalOpen}
        onClose={closeLevelModal}
        title={editingLevelId ? 'Editar nivel' : 'Novo nivel'}
        size="sm"
      >
        <form className="form" onSubmit={handleLevelSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="level-name">
              Nivel
            </label>
            <input
              id="level-name"
              className="form__input"
              type="text"
              value={levelForm.name}
              onChange={(event) => updateLevelForm({ name: event.target.value })}
            />
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="level-multiplier">
              Multiplicador
            </label>
            <input
              id="level-multiplier"
              className="form__input"
              type="number"
              min="0.1"
              step="0.1"
              value={levelForm.multiplier}
              onChange={(event) => updateLevelForm({ multiplier: Number(event.target.value) })}
            />
          </div>
          <div className="form__actions">
            <button className="button button--primary" type="submit">
              {editingLevelId ? 'Atualizar' : 'Salvar nivel'}
            </button>
            <button className="button button--ghost" type="button" onClick={closeLevelModal}>
              Cancelar
            </button>
          </div>
          {status && <p className="form__status">{status}</p>}
        </form>
      </Modal>

      <Modal
        open={isLogModalOpen}
        onClose={closeLogModal}
        title={editingLogId ? 'Editar apontamento' : 'Registrar producao'}
        size="lg"
      >
        <form className="form" onSubmit={handleLogSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="log-employee">
              Funcionario
            </label>
            <select
              id="log-employee"
              className="form__input"
              value={logForm.employeeId}
              onChange={(event) => updateLogForm({ employeeId: event.target.value })}
            >
              <option value="">Selecione um funcionario</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="log-product">
                Produto
              </label>
              <select
                id="log-product"
                className="form__input"
                value={logForm.productId}
                onChange={(event) => {
                  const productId = event.target.value
                  const product = data.produtos.find((item) => item.id === productId)
                  const firstVariant = product?.variants?.[0]
                  updateLogForm({
                    productId,
                    variantId: firstVariant?.id ?? '',
                  })
                }}
              >
                <option value="">Selecione um produto</option>
                {data.produtos.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="log-variant">
                Variacao
              </label>
              <select
                id="log-variant"
                className="form__input"
                value={logForm.variantId}
                onChange={(event) => updateLogForm({ variantId: event.target.value })}
                disabled={!logForm.productId}
              >
                <option value="">Selecione a variacao</option>
                {data.produtos
                  .find((product) => product.id === logForm.productId)
                  ?.variants?.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="log-quantity">
                Quantidade
              </label>
              <input
                id="log-quantity"
                className="form__input"
                type="number"
                min="1"
                value={logForm.quantity}
                onChange={(event) => updateLogForm({ quantity: Number(event.target.value) })}
              />
              {selectedLogProduct && selectedLaborBasis === 'metro' && (
                <span className="form__help">
                  Pagamento por metro.{' '}
                  {selectedLaborLength > 0
                    ? `Comprimento usado: ${selectedLaborLength}m por unidade.`
                    : 'Defina o comprimento no produto ou variacao.'}
                </span>
              )}
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="log-date">
                Data
              </label>
              <input
                id="log-date"
                className="form__input"
                type="date"
                value={logForm.workDate}
                onChange={(event) => updateLogForm({ workDate: event.target.value })}
              />
            </div>
          </div>

          <div className="form__actions">
            <button className="button button--primary" type="submit">
              {editingLogId ? 'Atualizar apontamento' : 'Registrar producao'}
            </button>
            <button className="button button--ghost" type="button" onClick={closeLogModal}>
              Cancelar
            </button>
          </div>
          {logStatus && <p className="form__status">{logStatus}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteEmployeeId}
        title="Excluir funcionario?"
        description={
          deleteEmployeeId
            ? `O funcionario ${getEmployee(deleteEmployeeId)?.name ?? ''} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteEmployeeId(null)}
        onConfirm={handleDeleteEmployee}
      />
      <ConfirmDialog
        open={!!deleteRoleId}
        title="Excluir cargo?"
        description={
          deleteRoleId
            ? `O cargo ${getRole(deleteRoleId)?.name ?? ''} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteRoleId(null)}
        onConfirm={handleDeleteRole}
      />
      <ConfirmDialog
        open={!!deleteLevelId}
        title="Excluir nivel?"
        description={
          deleteLevelId
            ? `O nivel ${getLevel(deleteLevelId)?.name ?? ''} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteLevelId(null)}
        onConfirm={handleDeleteLevel}
      />
      <ConfirmDialog
        open={!!deleteLogId}
        title="Excluir apontamento?"
        description="Este apontamento sera removido e o estoque sera ajustado."
        onClose={() => setDeleteLogId(null)}
        onConfirm={handleDeleteLog}
      />
    </section>
  )
}

export default Funcionarios
