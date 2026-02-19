const textEncoder = new TextEncoder()

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

const hashPinSha256 = async (pin: string) => {
  if (!globalThis.crypto?.subtle) {
    return null
  }
  const data = textEncoder.encode(pin)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

const hashPinFnv1a = (pin: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < pin.length; index += 1) {
    hash ^= pin.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const splitHash = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  const idx = trimmed.indexOf(':')
  if (idx < 0) {
    return { scheme: 'legacy', hash: trimmed }
  }
  return {
    scheme: trimmed.slice(0, idx) || 'legacy',
    hash: trimmed.slice(idx + 1),
  }
}

const buildHash = (scheme: string, hash: string) => `${scheme}:${hash}`

export const hashPin = async (pin: string) => {
  const normalized = pin.trim()
  if (!normalized) {
    return ''
  }
  const sha = await hashPinSha256(normalized)
  if (sha) {
    return buildHash('sha256', sha)
  }
  return buildHash('fnv1a', hashPinFnv1a(normalized))
}

export const verifyPin = async (pin: string, storedHash?: string) => {
  if (!storedHash) {
    return false
  }
  const normalized = pin.trim()
  if (!normalized) {
    return false
  }
  const { scheme, hash } = splitHash(storedHash)
  if (!hash) {
    return false
  }

  if (scheme === 'sha256') {
    const sha = await hashPinSha256(normalized)
    return !!sha && sha === hash
  }

  if (scheme === 'fnv1a') {
    return hashPinFnv1a(normalized) === hash
  }

  const sha = await hashPinSha256(normalized)
  if (sha && sha === hash) {
    return true
  }
  return hashPinFnv1a(normalized) === hash
}
