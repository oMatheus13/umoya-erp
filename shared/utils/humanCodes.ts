import type { SequenceEntry } from '../types/erp'

const DATE_KEY_PATTERN = /^\d{8}$/
const CODE_PATTERN = (prefix: string) =>
  new RegExp(`^${prefix}-(\\d{8})-(\\d{4})$`, 'i')

export const getDateKey = (value?: string) => {
  if (value) {
    const trimmed = value.trim()
    if (DATE_KEY_PATTERN.test(trimmed)) {
      return trimmed
    }
    const datePart = trimmed.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart.replace(/-/g, '')
    }
  }
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

export const buildDailyCode = (prefix: string, dateKey: string, seq: number) =>
  `${prefix}-${dateKey}-${String(seq).padStart(4, '0')}`

export const parseDailyCode = (code: string, prefix: string) => {
  const match = code.trim().match(CODE_PATTERN(prefix))
  if (!match) {
    return null
  }
  const seq = Number(match[2])
  if (!Number.isFinite(seq)) {
    return null
  }
  return { dateKey: match[1], seq }
}

export const getNextSequence = (sequences: SequenceEntry[], key: string) => {
  const index = sequences.findIndex((entry) => entry.key === key)
  if (index >= 0) {
    const nextValue = (sequences[index].currentValue ?? 0) + 1
    sequences[index] = { ...sequences[index], currentValue: nextValue }
    return nextValue
  }
  const nextValue = 1
  sequences.push({ key, currentValue: nextValue })
  return nextValue
}

const PUBLIC_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

export const generatePublicCode = (length = 6) => {
  if (length <= 0) {
    return ''
  }
  const values = new Uint8Array(length)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values)
  } else {
    for (let i = 0; i < values.length; i += 1) {
      values[i] = Math.floor(Math.random() * 256)
    }
  }
  let result = ''
  for (let i = 0; i < values.length; i += 1) {
    result += PUBLIC_CODE_ALPHABET[values[i] % PUBLIC_CODE_ALPHABET.length]
  }
  return result
}
