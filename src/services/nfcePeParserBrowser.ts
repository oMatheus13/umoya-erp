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
  const cleaned = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const findValueByLabels = (doc: Document, labels: string[]) => {
  const normalizedLabels = labels.map(normalizeLabel)
  const rows = Array.from(doc.querySelectorAll('tr'))
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td, th'))
    if (cells.length < 2) {
      continue
    }
    const labelText = normalizeLabel(cells[0].textContent ?? '')
    if (normalizedLabels.some((label) => labelText.includes(label))) {
      return normalizeText(cells[1].textContent ?? '')
    }
  }
  return ''
}

const findItemsTable = (doc: Document) => {
  const tables = Array.from(doc.querySelectorAll('table'))
  for (const table of tables) {
    const headerRow =
      table.querySelector('thead tr') ?? table.querySelector('tr')
    if (!headerRow) {
      continue
    }
    const headers = Array.from(headerRow.querySelectorAll('th, td')).map((cell) =>
      normalizeLabel(cell.textContent ?? ''),
    )
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

const parseItemsFromTable = (table: HTMLTableElement, headers: string[]) => {
  const rows = Array.from(table.querySelectorAll('tbody tr'))
  const bodyRows = rows.length > 0 ? rows : Array.from(table.querySelectorAll('tr')).slice(1)
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
    const cells = Array.from(row.querySelectorAll('td'))
    if (cells.length === 0) {
      return
    }
    const description = normalizeText(cells[descriptionIndex]?.textContent ?? '')
    if (!description) {
      return
    }
    const code = normalizeText(cells[codeIndex]?.textContent ?? '')
    const quantity = parseNumber(cells[quantityIndex]?.textContent ?? '')
    const unit = normalizeText(cells[unitIndex]?.textContent ?? '')
    const unitPrice = parseNumber(cells[unitPriceIndex]?.textContent ?? '')
    const totalPrice =
      parseNumber(cells[totalIndex]?.textContent ?? '') || quantity * unitPrice
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

export const parsePeNfceHtmlBrowser = (html: string, sourceUrl: string): ImportedNfceData => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('Parser indisponivel no navegador.')
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const accessKey = extractAccessKeyFromUrl(sourceUrl)
  const supplierName =
    findValueByLabels(doc, ['emitente', 'fornecedor', 'razao social', 'nome']) ||
    normalizeText(doc.querySelector('.emitente')?.textContent ?? '')
  const supplierDocument = findValueByLabels(doc, ['cnpj', 'cpf'])
  const supplierAddress = findValueByLabels(doc, ['endereco', 'endereço'])
  const noteNumber = findValueByLabels(doc, ['numero', 'número'])
  const noteSeries = findValueByLabels(doc, ['serie', 'série'])
  const issuedAt = findValueByLabels(doc, ['emissao', 'emissão', 'data'])
  const authorizationProtocol = findValueByLabels(doc, ['protocolo'])
  const paymentMethod = findValueByLabels(doc, ['pagamento', 'forma de pagamento'])
  const paymentValueText = findValueByLabels(doc, ['valor pago', 'valor pagamento'])
  const totalAmountText = findValueByLabels(doc, [
    'valor total',
    'total a pagar',
    'total',
  ])

  const tableInfo = findItemsTable(doc)
  const items = tableInfo ? parseItemsFromTable(tableInfo.table, tableInfo.headers) : []
  const totalAmount =
    parseNumber(totalAmountText) ||
    items.reduce((acc, item) => acc + (item.totalPrice ?? 0), 0)
  const totalItems = items.length

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
    totalItems,
    totalAmount,
    items,
  }
}
