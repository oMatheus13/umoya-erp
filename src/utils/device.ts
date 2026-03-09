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

export const isMobileDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }
  const agent = navigator.userAgent || navigator.vendor || ''
  const isMobileAgent = /android|iphone|ipad|ipod|mobile|opera mini|iemobile/i.test(agent)
  const isTouch =
    'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
  const isSmallScreen = window.matchMedia
    ? window.matchMedia('(max-width: 768px)').matches
    : false
  return isMobileAgent || (isTouch && isSmallScreen)
}

export const hasCameraSupport = () => {
  if (typeof navigator === 'undefined') {
    return false
  }
  return typeof navigator.mediaDevices?.getUserMedia === 'function'
}
