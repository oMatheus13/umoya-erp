import type { ImportedNfceData } from '../types/nfce'
import {
  buildPeNfceUrlFromAccessKey,
  extractAccessKeyFromUrl,
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

const fetchParsedData = async (url: string) => {
  const response = await fetch(`/api/nfce-parse?url=${encodeURIComponent(url)}`)
  if (!response.ok) {
    throw new Error('Nao foi possivel consultar a NFC-e pelo servidor.')
  }
  return (await response.json()) as ImportedNfceData
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

  try {
    const html = await fetchHtml(sourceUrl)
    const parsed = parsePeNfceHtmlBrowser(html, sourceUrl)
    if (!parsed.items.length || parsed.totalAmount <= 0) {
      throw new Error('Parser incompleto.')
    }
    return {
      ...parsed,
      accessKey: parsed.accessKey ?? accessKey,
    }
  } catch {
    const parsed = await fetchParsedData(sourceUrl)
    return {
      ...parsed,
      accessKey: parsed.accessKey ?? accessKey,
    }
  }
}
