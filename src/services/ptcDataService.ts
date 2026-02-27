import type { PtcProject, PtcRoom, PtcSettings, PtcState } from '../types/ptc'
import { createEmptyState, getStorage, saveStorage } from './ptcStorage'

type RemoteSync = (data: PtcState) => void | Promise<void>
type SaveOptions = {
  touchMeta?: boolean
  skipSync?: boolean
  emitEvent?: boolean
}

let remoteSync: RemoteSync | null = null

export const setPtcRemoteSync = (sync: RemoteSync | null) => {
  remoteSync = sync
}

const dispatchDataEvent = () => {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new Event('umoya:ptc'))
}

const normalizeSettings = (settings?: Partial<PtcSettings>): PtcSettings => ({
  vigotaSpacingCm: Number.isFinite(settings?.vigotaSpacingCm)
    ? (settings?.vigotaSpacingCm as number)
    : 0,
  capacityPerDayM: Number.isFinite(settings?.capacityPerDayM)
    ? (settings?.capacityPerDayM as number)
    : 0,
  epsProductId: settings?.epsProductId,
})

const saveAndSync = (data: PtcState, options?: SaveOptions) => {
  const shouldTouchMeta = options?.touchMeta !== false
  const shouldEmitEvent = options?.emitEvent !== false
  const next: PtcState = shouldTouchMeta
    ? {
        ...data,
        meta: {
          ...data.meta,
          updatedAt: new Date().toISOString(),
        },
      }
    : data
  saveStorage(next)
  if (shouldEmitEvent) {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(dispatchDataEvent)
    } else {
      setTimeout(dispatchDataEvent, 0)
    }
  }
  if (remoteSync && !options?.skipSync) {
    void remoteSync(next)
  }
}

const normalizeData = (data: PtcState): PtcState => {
  let changed = false
  const projects = Array.isArray(data.projects) ? data.projects : []
  const rooms = Array.isArray(data.rooms) ? data.rooms : []
  const calculations = Array.isArray(data.calculations) ? data.calculations : []
  const calculationItems = Array.isArray(data.calculationItems)
    ? data.calculationItems
    : []
  const productionLists = Array.isArray(data.productionLists)
    ? data.productionLists
    : []
  if (projects !== data.projects) changed = true
  if (rooms !== data.rooms) changed = true
  if (calculations !== data.calculations) changed = true
  if (calculationItems !== data.calculationItems) changed = true
  if (productionLists !== data.productionLists) changed = true

  const settings = normalizeSettings(data.settings)
  if (
    settings.vigotaSpacingCm !== data.settings?.vigotaSpacingCm ||
    settings.capacityPerDayM !== data.settings?.capacityPerDayM ||
    settings.epsProductId !== data.settings?.epsProductId
  ) {
    changed = true
  }

  const meta = data.meta?.updatedAt ? data.meta : { updatedAt: new Date().toISOString() }
  if (meta !== data.meta) {
    changed = true
  }

  const normalized: PtcState = {
    projects,
    rooms,
    calculations,
    calculationItems,
    productionLists,
    settings,
    meta,
  }

  if (changed) {
    saveAndSync(normalized, { emitEvent: false })
  }

  return normalized
}

const upsert = <T extends { id: string }>(items: T[], next: T) => {
  const index = items.findIndex((item) => item.id === next.id)
  if (index >= 0) {
    const copy = items.slice()
    copy[index] = next
    return copy
  }
  return [...items, next]
}

export type PtcDataService = {
  getAll: () => PtcState
  replaceAll: (data: PtcState, options?: SaveOptions) => void
  upsertProject: (project: PtcProject, options?: SaveOptions) => void
  upsertRoom: (room: PtcRoom, options?: SaveOptions) => void
  removeRoom: (roomId: string, options?: SaveOptions) => void
  removeProject: (projectId: string, options?: SaveOptions) => void
  setSettings: (settings: Partial<PtcSettings>, options?: SaveOptions) => void
}

export const ptcDataService: PtcDataService = {
  getAll: () => normalizeData(getStorage() ?? createEmptyState()),
  replaceAll: (data, options) => saveAndSync(normalizeData(data), options),
  upsertProject: (project, options) => {
    const data = getStorage() ?? createEmptyState()
    data.projects = upsert(data.projects, project)
    saveAndSync(normalizeData(data), options)
  },
  upsertRoom: (room, options) => {
    const data = getStorage() ?? createEmptyState()
    data.rooms = upsert(data.rooms, room)
    saveAndSync(normalizeData(data), options)
  },
  removeRoom: (roomId, options) => {
    const data = getStorage() ?? createEmptyState()
    data.rooms = data.rooms.filter((room) => room.id !== roomId)
    saveAndSync(normalizeData(data), options)
  },
  removeProject: (projectId, options) => {
    const data = getStorage() ?? createEmptyState()
    data.projects = data.projects.filter((project) => project.id !== projectId)
    data.rooms = data.rooms.filter((room) => room.projectId !== projectId)
    saveAndSync(normalizeData(data), options)
  },
  setSettings: (settings, options) => {
    const data = getStorage() ?? createEmptyState()
    data.settings = normalizeSettings({ ...data.settings, ...settings })
    saveAndSync(normalizeData(data), options)
  },
}
