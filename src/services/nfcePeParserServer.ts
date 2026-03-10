import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { ImportedNfceData, ImportedNfceItem } from '../types/nfce'
import { extractAccessKeyFromUrl } from '../utils/nfce'

const normalizeText = (value?: string) =>
  (value ?? '').replace(/\s+/g, ' ').trim()

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const parseNumber = (value?: string) => {
  if (!value) {
    return 0
  }
  const cleaned = value.replace(/[^\d,.-]/g, '')
  if (!cleaned) {
    return 0
  }
  const hasComma = cleaned.includes(',')
  const normalized = hasComma
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const findValueByLabels = ($: cheerio.CheerioAPI, labels: string[]) => {
  const normalizedLabels = labels.map(normalizeLabel)
  const rows = $('tr')
  for (const row of rows.toArray()) {
    const cells = $(row).find('td, th')
    if (cells.length < 2) {
      continue
    }
    const labelText = normalizeLabel($(cells[0]).text())
    if (normalizedLabels.some((label) => labelText.includes(label))) {
      return normalizeText($(cells[1]).text())
    }
  }
  return ''
}

const findItemsTable = ($: cheerio.CheerioAPI) => {
  const tables = $('table').toArray()
  for (const table of tables) {
    const headerRow =
      $(table).find('thead tr').first() || $(table).find('tr').first()
    const headers = headerRow
      .find('th, td')
      .toArray()
      .map((cell) => normalizeLabel($(cell).text()))
    if (!headers.length) {
      continue
    }
    const hasDescription = headers.some((label) =>
      ['descricao', 'descr', 'produto', 'item'].some((key) => label.includes(key)),
    )
    const hasQuantity = headers.some((label) =>
      ['qtd', 'qtde', 'quant'].some((key) => label.includes(key)),
    )
    const hasTotal = headers.some((label) =>
      ['total', 'vl total', 'valor total'].some((key) => label.includes(key)),
    )
    if (hasDescription && hasQuantity && hasTotal) {
      return { table, headers }
    }
  }
  return null
}

const parseItemsFromTable = (
  $: cheerio.CheerioAPI,
  table: AnyNode,
  headers: string[],
) => {
  const bodyRows =
    $(table).find('tbody tr').toArray().length > 0
      ? $(table).find('tbody tr').toArray()
      : $(table).find('tr').slice(1).toArray()
  const items: ImportedNfceItem[] = []
  const resolveIndex = (keys: string[]) =>
    headers.findIndex((label) => keys.some((key) => label.includes(key)))

  const descriptionIndex = resolveIndex(['descricao', 'descr', 'produto', 'item'])
  const codeIndex = resolveIndex(['codigo', 'cod'])
  const quantityIndex = resolveIndex(['qtd', 'qtde', 'quant'])
  const unitIndex = resolveIndex(['un', 'und', 'unidade'])
  const unitPriceIndex = resolveIndex(['vl unit', 'valor unit'])
  const totalIndex = resolveIndex(['total', 'vl total', 'valor total'])

  bodyRows.forEach((row) => {
    const cells = $(row).find('td').toArray()
    if (cells.length === 0) {
      return
    }
    const description = normalizeText($(cells[descriptionIndex]).text())
    if (!description) {
      return
    }
    const code = normalizeText($(cells[codeIndex]).text())
    const quantity = parseNumber($(cells[quantityIndex]).text())
    const unit = normalizeText($(cells[unitIndex]).text())
    const unitPrice = parseNumber($(cells[unitPriceIndex]).text())
    const totalPrice =
      parseNumber($(cells[totalIndex]).text()) || quantity * unitPrice
    items.push({
      description,
      code: code || undefined,
      quantity: quantity || 0,
      unit: unit || undefined,
      unitPrice: unitPrice || 0,
      totalPrice: totalPrice || 0,
    })
  })

  return items
}

export const parsePeNfceHtmlServer = (
  html: string,
  sourceUrl: string,
): ImportedNfceData => {
  const $ = cheerio.load(html)
  const accessKey = extractAccessKeyFromUrl(sourceUrl)
  const supplierName =
    findValueByLabels($, ['emitente', 'fornecedor', 'razao social', 'nome']) ||
    normalizeText($('.emitente').text())
  const supplierDocument = findValueByLabels($, ['cnpj', 'cpf'])
  const supplierAddress = findValueByLabels($, ['endereco', 'endereço'])
  const noteNumber = findValueByLabels($, ['numero', 'número'])
  const noteSeries = findValueByLabels($, ['serie', 'série'])
  const issuedAt = findValueByLabels($, ['emissao', 'emissão', 'data'])
  const authorizationProtocol = findValueByLabels($, ['protocolo'])
  const paymentMethod = findValueByLabels($, ['pagamento', 'forma de pagamento'])
  const paymentValueText = findValueByLabels($, ['valor pago', 'valor pagamento'])
  const totalAmountText = findValueByLabels($, [
    'valor total',
    'total a pagar',
    'total',
  ])

  const tableInfo = findItemsTable($)
  const items = tableInfo ? parseItemsFromTable($, tableInfo.table, tableInfo.headers) : []
  const totalAmount =
    parseNumber(totalAmountText) ||
    items.reduce((acc, item) => acc + (item.totalPrice ?? 0), 0)

  return {
    sourceUrl,
    accessKey: accessKey || undefined,
    supplierName: supplierName || 'Fornecedor',
    supplierDocument: supplierDocument || undefined,
    supplierAddress: supplierAddress || undefined,
    noteNumber: noteNumber || undefined,
    noteSeries: noteSeries || undefined,
    issuedAt: issuedAt || undefined,
    authorizationProtocol: authorizationProtocol || undefined,
    paymentMethod: paymentMethod || undefined,
    paymentValue: parseNumber(paymentValueText) || undefined,
    totalItems: items.length,
    totalAmount,
    items,
  }
}
