import type { ImportedNfceData } from '../types/nfce'
import {
  buildPeNfceUrlFromAccessKey,
  extractAccessKeyFromUrl,
  normalizeAccessKey,
} from '../utils/nfce'
import { parsePeNfceHtmlBrowser } from './nfcePeParserBrowser'

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
  })
  if (!response.ok) {
    throw new Error('Nao foi possivel acessar a NFC-e.')
  }
  return response.text()
}

const isIncompleteQrUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    const param = parsed.searchParams.get('p')
    if (!param) {
      return false
    }
    const hasPipe = param.includes('|')
    const cleaned = normalizeAccessKey(param)
    return !hasPipe && cleaned.length >= 44
  } catch {
    return false
  }
}

const fetchParsedData = async (url: string) => {
  const response = await fetch(`/api/nfce-parse?url=${encodeURIComponent(url)}`)
  if (!response.ok) {
    let message = 'Nao foi possivel consultar a NFC-e pelo servidor.'
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload?.error) {
        message = payload.error
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await response.json()) as ImportedNfceData
  }
  const html = await response.text()
  const parsed = parsePeNfceHtmlBrowser(html, url)
  if (!parsed.items.length || parsed.totalAmount <= 0) {
    throw new Error(
      'Nao foi possivel ler a NFC-e. Use a URL completa do QR Code.',
    )
  }
  return parsed
}

export const importPeNfceData = async (input: {
  url?: string
  accessKey?: string
}) => {
  const urlInput = (input.url ?? '').trim()
  const accessKeyInput = (input.accessKey ?? '').trim()
  const sourceUrl = urlInput
    ? urlInput
    : buildPeNfceUrlFromAccessKey(accessKeyInput)
  const accessKey =
    accessKeyInput || extractAccessKeyFromUrl(sourceUrl) || undefined
  if (isIncompleteQrUrl(sourceUrl)) {
    throw new Error(
      'Para NFC-e PE, a chave isolada nao funciona. Use a URL completa do QR Code.',
    )
  }
  const resolvedUrl = encodeURI(sourceUrl)

  try {
    const html = await fetchHtml(resolvedUrl)
    const parsed = parsePeNfceHtmlBrowser(html, sourceUrl)
    if (!parsed.items.length || parsed.totalAmount <= 0) {
      throw new Error(
        'Nao foi possivel ler a NFC-e. Use a URL completa do QR Code.',
      )
    }
    return {
      ...parsed,
      accessKey: parsed.accessKey ?? accessKey,
    }
  } catch {
    const parsed = await fetchParsedData(resolvedUrl)
    return {
      ...parsed,
      accessKey: parsed.accessKey ?? accessKey,
    }
  }
}
