import type { PtcState } from '../types/ptc'

let memoryState: PtcState | null = null

export const createEmptyState = (): PtcState => ({
  projects: [],
  rooms: [],
  calculations: [],
  calculationItems: [],
  productionLists: [],
  settings: {
    vigotaSpacingCm: 0,
    capacityPerDayM: 0,
  },
  meta: {
    updatedAt: new Date().toISOString(),
  },
})

export const getStorage = (): PtcState | null => memoryState

export const saveStorage = (data: PtcState) => {
  memoryState = data
}

export const clearStorage = () => {
  memoryState = null
}
