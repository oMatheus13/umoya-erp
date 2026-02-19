import { createId } from './ids'

const DEVICE_STORAGE_KEY = 'umoya_pop_device_id'

export const resolveDeviceId = () => {
  if (typeof window === 'undefined') {
    return 'device-unknown'
  }
  try {
    const stored = window.localStorage.getItem(DEVICE_STORAGE_KEY)
    if (stored) {
      return stored
    }
    const next = createId()
    window.localStorage.setItem(DEVICE_STORAGE_KEY, next)
    return next
  } catch {
    return createId()
  }
}

export const resolveDeviceInfo = () => {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }
  const parts = [navigator.platform, navigator.userAgent].filter(Boolean)
  return parts.join(' | ')
}
