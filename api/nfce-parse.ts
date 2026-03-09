import type { IncomingMessage, ServerResponse } from 'http'
import { parsePeNfceHtmlServer } from '../src/services/nfcePeParserServer'

type ApiRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>
}

const isAllowedHost = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('sefaz.pe.gov.br')
  } catch {
    return false
  }
}

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(payload))
}

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Metodo nao suportado.' })
    return
  }
  const urlParam = req.query?.url
  const url =
    typeof urlParam === 'string'
      ? urlParam
      : Array.isArray(urlParam)
        ? urlParam[0]
        : ''
  if (!url) {
    sendJson(res, 400, { error: 'URL da NFC-e nao informada.' })
    return
  }
  if (!isAllowedHost(url)) {
    sendJson(res, 400, { error: 'Dominio da NFC-e nao permitido.' })
    return
  }
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (UmoyaOS NFC-e Importer)',
      },
    })
    if (!response.ok) {
      sendJson(res, 502, { error: 'Erro ao acessar a NFC-e.' })
      return
    }
    const html = await response.text()
    const data = parsePeNfceHtmlServer(html, url)
    sendJson(res, 200, data)
  } catch (error) {
    sendJson(res, 500, {
      error:
        error instanceof Error ? error.message : 'Falha ao processar NFC-e.',
    })
  }
}
