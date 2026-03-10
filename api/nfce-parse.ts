import https from 'https'
import type { IncomingMessage, ServerResponse } from 'http'

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

const sendText = (res: ServerResponse, status: number, body: string) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(body)
}

const buildHeaders = () => ({
  'user-agent': 'Mozilla/5.0 (UmoyaOS NFC-e Importer)',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9',
})

const fetchHtmlViaHttps = (url: string, redirectCount = 0): Promise<string> =>
  new Promise((resolve, reject) => {
    const request = https.get(url, { headers: buildHeaders() }, (response) => {
      const statusCode = response.statusCode ?? 0
      const location = response.headers.location
      if (
        statusCode >= 300 &&
        statusCode < 400 &&
        location &&
        redirectCount < 5
      ) {
        response.resume()
        resolve(fetchHtmlViaHttps(location, redirectCount + 1))
        return
      }
      let data = ''
      response.setEncoding('utf-8')
      response.on('data', (chunk) => {
        data += chunk
      })
      response.on('end', () => resolve(data))
    })
    request.on('error', (error) => reject(error))
  })

const fetchHtml = async (url: string) => {
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      headers: buildHeaders(),
      redirect: 'follow',
    })
    const text = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      text,
    }
  }
  const text = await fetchHtmlViaHttps(url)
  return { ok: true, status: 200, text }
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
    const response = await fetchHtml(url)
    if (!response.ok) {
      sendJson(res, 502, { error: 'Erro ao acessar a NFC-e.' })
      return
    }
    sendText(res, 200, response.text)
  } catch (error) {
    sendJson(res, 500, {
      error:
        error instanceof Error ? error.message : 'Falha ao processar NFC-e.',
    })
  }
}
