const MAX_AVATAR_URL_LENGTH = 4096

export const sanitizeAvatarUrl = (value?: string) => {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  if (trimmed.startsWith('data:')) {
    return undefined
  }
  if (trimmed.length > MAX_AVATAR_URL_LENGTH) {
    return undefined
  }
  return trimmed
}
