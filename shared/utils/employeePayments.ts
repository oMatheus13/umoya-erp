import type { EmployeePayment, ERPData, WorkLog } from '../types/erp'
import { createId } from './ids'

const normalizeDate = (value?: string) => (value ? value.slice(0, 10) : '')

const resolveLogDate = (log: WorkLog) =>
  normalizeDate(log.workDate || log.createdAt)

const getLatestDate = (values: string[]) =>
  values.reduce((latest, current) => (current > latest ? current : latest), '')

const sumLogs = (logs: WorkLog[]) =>
  logs.reduce((acc, log) => acc + (Number.isFinite(log.totalPay) ? log.totalPay : 0), 0)

export const syncOpenEmployeePayment = (payload: ERPData, employeeId: string) => {
  const logs = payload.apontamentos.filter((log) => log.employeeId === employeeId)
  const paidPayments = payload.pagamentosRH.filter(
    (payment) => payment.employeeId === employeeId && payment.status === 'pago',
  )
  const lastPaidEnd = getLatestDate(paidPayments.map((payment) => normalizeDate(payment.periodEnd)))
  const pendingLogs = logs.filter((log) => {
    const logDate = resolveLogDate(log)
    if (!logDate) {
      return false
    }
    return lastPaidEnd ? logDate > lastPaidEnd : true
  })

  const openPayments = payload.pagamentosRH.filter(
    (payment) => payment.employeeId === employeeId && payment.status === 'aberto',
  )
  const target =
    openPayments.find((payment) => payment.autoFromLogs) ??
    [...openPayments].sort((a, b) =>
      normalizeDate(b.periodEnd).localeCompare(normalizeDate(a.periodEnd)),
    )[0]

  if (pendingLogs.length === 0) {
    if (target?.autoFromLogs) {
      payload.pagamentosRH = payload.pagamentosRH.filter(
        (payment) => payment.id !== target.id,
      )
    }
    return
  }

  const dates = pendingLogs.map(resolveLogDate).filter(Boolean)
  const periodStart = dates.reduce(
    (earliest, current) => (current < earliest ? current : earliest),
    dates[0],
  )
  const periodEnd = getLatestDate(dates)
  const baseValue = sumLogs(pendingLogs)

  if (target) {
    const total = baseValue + (target.extras ?? 0) - (target.discounts ?? 0)
    const next: EmployeePayment = {
      ...target,
      periodStart,
      periodEnd,
      baseValue,
      total,
      autoFromLogs: true,
    }
    payload.pagamentosRH = payload.pagamentosRH.map((payment) =>
      payment.id === target.id ? next : payment,
    )
    return
  }

  const createdAt = new Date().toISOString()
  payload.pagamentosRH = [
    ...payload.pagamentosRH,
    {
      id: createId(),
      employeeId,
      periodStart,
      periodEnd,
      baseValue,
      extras: 0,
      discounts: 0,
      total: baseValue,
      status: 'aberto',
      createdAt,
      autoFromLogs: true,
    },
  ]
}
