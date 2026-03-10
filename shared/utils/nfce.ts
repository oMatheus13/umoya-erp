const PE_NFCE_BASE_URL = 'https://nfce.sefaz.pe.gov.br/nfce/consulta?p='

export const normalizeAccessKey = (value: string) =>
  value.replace(/\D/g, '')

export const extractAccessKeyFromUrl = (value: string) => {
  if (!value) {
    return ''
  }
  try {
    const parsed = new URL(value)
    const param = parsed.searchParams.get('p') ?? ''
    const maybe = normalizeAccessKey(param)
    if (maybe.length >= 44) {
      return maybe.slice(0, 44)
    }
  } catch {
    // ignore parsing errors
  }
  const match = value.match(/\d{44}/)
  return match ? match[0] : ''
}

export const buildPeNfceUrlFromAccessKey = (accessKey: string) => {
  const cleaned = normalizeAccessKey(accessKey)
  if (cleaned.length < 44) {
    throw new Error('Chave de acesso incompleta.')
  }
  return `${PE_NFCE_BASE_URL}${cleaned.slice(0, 44)}`
}

export const normalizeNfceLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
