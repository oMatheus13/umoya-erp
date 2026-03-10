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

const extractByRegex = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }
  return ''
}

const extractNumberByRegex = (text: string, patterns: RegExp[]) => {
  const raw = extractByRegex(text, patterns)
  return raw ? parseNumber(raw) : 0
}

const extractTextBySelectors = (container: Element, selectors: string[]) => {
  for (const selector of selectors) {
    const element = container.querySelector(selector)
    const value = normalizeText(element?.textContent ?? '')
    if (value) {
      return value
    }
  }
  return ''
}

const parseNfceXml = (xml: string, sourceUrl: string): ImportedNfceData | null => {
  if (typeof DOMParser === 'undefined') {
    return null
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return null
  }

  const getText = (tag: string, parent?: Element | Document) =>
    normalizeText(parent?.getElementsByTagName(tag)?.[0]?.textContent ?? '')

  const accessKey = extractAccessKeyFromUrl(sourceUrl)
  const emit = doc.getElementsByTagName('emit')[0]
  const enderEmit = emit?.getElementsByTagName('enderEmit')?.[0]
  const supplierName = getText('xNome', emit) || 'Fornecedor'
  const supplierDocument = getText('CNPJ', emit) || getText('CPF', emit)
  const addressParts = [
    getText('xLgr', enderEmit),
    getText('nro', enderEmit),
    getText('xCpl', enderEmit),
    getText('xBairro', enderEmit),
    getText('xMun', enderEmit),
    getText('UF', enderEmit),
  ].filter(Boolean)
  const supplierAddress = addressParts.length > 0 ? addressParts.join(', ') : ''

  const ide = doc.getElementsByTagName('ide')[0]
  const noteNumber = getText('nNF', ide)
  const noteSeries = getText('serie', ide)
  const issuedAt = getText('dhEmi', ide) || getText('dEmi', ide)
  const authorizationProtocol = getText(
    'nProt',
    doc.getElementsByTagName('infProt')[0],
  )

  const detPag = doc.getElementsByTagName('detPag')[0]
  const paymentValue = parseNumber(getText('vPag', detPag))
  const paymentCode = getText('tPag', detPag)
  const paymentLabels: Record<string, string> = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartao de credito',
    '04': 'Cartao de debito',
    '05': 'Credito loja',
    '10': 'Vale alimentacao',
    '11': 'Vale refeicao',
    '12': 'Vale presente',
    '13': 'Vale combustivel',
    '14': 'Duplicata mercantil',
    '15': 'Boleto',
    '16': 'Deposito bancario',
    '17': 'Pix',
    '18': 'Transferencia bancaria',
    '19': 'Programa de fidelidade',
    '90': 'Sem pagamento',
    '99': 'Outros',
  }
  const paymentMethod = paymentLabels[paymentCode] ?? paymentCode

  const totalNode = doc.getElementsByTagName('ICMSTot')[0]
  const totalAmount =
    parseNumber(getText('vNF', totalNode)) ||
    parseNumber(getText('vProd', totalNode))

  const items: ImportedNfceItem[] = []
  const detNodes = Array.from(doc.getElementsByTagName('det'))
  detNodes.forEach((det) => {
    const prod = det.getElementsByTagName('prod')[0]
    if (!prod) {
      return
    }
    const description = getText('xProd', prod)
    if (!description) {
      return
    }
    const code = getText('cProd', prod)
    const quantity = parseNumber(getText('qCom', prod))
    const unit = getText('uCom', prod)
    const unitPrice = parseNumber(getText('vUnCom', prod))
    const totalPrice = parseNumber(getText('vProd', prod)) || quantity * unitPrice
    items.push({
      description,
      code: code || undefined,
      quantity: quantity || 0,
      unit: unit || undefined,
      unitPrice: unitPrice || 0,
      totalPrice: totalPrice || 0,
    })
  })

  return {
    sourceUrl,
    accessKey: accessKey || undefined,
    supplierName,
    supplierDocument: supplierDocument || undefined,
    supplierAddress: supplierAddress || undefined,
    noteNumber: noteNumber || undefined,
    noteSeries: noteSeries || undefined,
    issuedAt: issuedAt || undefined,
    authorizationProtocol: authorizationProtocol || undefined,
    paymentMethod: paymentMethod || undefined,
    paymentValue: paymentValue || undefined,
    totalItems: items.length,
    totalAmount: totalAmount || items.reduce((acc, item) => acc + item.totalPrice, 0),
    items,
  }
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

const parseItemsFromLayout = (doc: Document) => {
  const nodes = Array.from(
    doc.querySelectorAll(
      '.txtTit, .txtTit2, .txtProd, .prodDesc, .produto, .descricao',
    ),
  )
  const items: ImportedNfceItem[] = []
  const seen = new Set<Element>()

  nodes.forEach((node) => {
    const container =
      node.closest('tr, li, div') ?? node.parentElement ?? undefined
    if (!container || seen.has(container)) {
      return
    }
    seen.add(container)
    const description = normalizeText(node.textContent ?? '')
    if (!description) {
      return
    }
    const containerText = normalizeText(container.textContent ?? '')
    const code =
      extractTextBySelectors(container, ['.txtCod', '.txtCodigo', '.codigo', '.cod']) ||
      extractByRegex(containerText, [/cod\.?\s*:?\s*([a-z0-9-]+)/i, /codigo\s*:?\s*([a-z0-9-]+)/i])
    const quantityText = extractTextBySelectors(container, [
      '.Rqtd',
      '.txtQtd',
      '.qtd',
      '.quantidade',
    ])
    const unitText = extractTextBySelectors(container, ['.RUN', '.txtUn', '.un', '.unid'])
    const unitPriceText = extractTextBySelectors(container, [
      '.RvlUnit',
      '.vlUnit',
      '.vUnit',
      '.valorUnit',
    ])
    const totalCandidates = Array.from(
      container.querySelectorAll('.valor, .vlItem, .vItem, .RvlTot'),
    )
    const totalText = normalizeText(
      totalCandidates[totalCandidates.length - 1]?.textContent ?? '',
    )

    const quantity =
      parseNumber(quantityText) ||
      extractNumberByRegex(containerText, [
        /qtd\.?\s*:?\s*([\d.,]+)/i,
        /qtde\.?\s*:?\s*([\d.,]+)/i,
      ])
    const unit = unitText ||
      extractByRegex(containerText, [/un\.?\s*:?\s*([a-z]+)/i, /unidade\s*:?\s*([a-z]+)/i])
    const unitPrice =
      parseNumber(unitPriceText) ||
      extractNumberByRegex(containerText, [
        /vl\.?\s*unit\.?\s*:?\s*([\d.,]+)/i,
        /valor\s*unit\.?\s*:?\s*([\d.,]+)/i,
      ])
    const totalPrice =
      parseNumber(totalText) ||
      extractNumberByRegex(containerText, [
        /vl\.?\s*total\.?\s*:?\s*([\d.,]+)/i,
        /valor\s*total\.?\s*:?\s*([\d.,]+)/i,
      ]) ||
      (quantity && unitPrice ? quantity * unitPrice : 0)

    items.push({
      description,
      code: code || undefined,
      quantity: quantity || 0,
      unit: unit || undefined,
      unitPrice: unitPrice || (quantity ? totalPrice / quantity : 0),
      totalPrice: totalPrice || 0,
    })
  })

  return items
}

export const parsePeNfceHtmlBrowser = (html: string, sourceUrl: string): ImportedNfceData => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('Parser indisponivel no navegador.')
  }
  const trimmed = html.trim()
  if (trimmed.startsWith('<?xml') || trimmed.includes('<nfeProc')) {
    const parsedXml = parseNfceXml(html, sourceUrl)
    if (parsedXml) {
      return parsedXml
    }
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const accessKey = extractAccessKeyFromUrl(sourceUrl)
  const pageText = normalizeText(doc.body?.textContent ?? '')
  const supplierName =
    findValueByLabels(doc, ['emitente', 'fornecedor', 'razao social', 'nome']) ||
    normalizeText(
      doc.querySelector('.emitente, .txtNome, .txtEmitente')?.textContent ?? '',
    )
  const supplierDocument =
    findValueByLabels(doc, ['cnpj', 'cpf']) ||
    extractByRegex(pageText, [/cnpj\s*:?\s*([\d./-]+)/i, /cpf\s*:?\s*([\d./-]+)/i])
  const supplierAddress =
    findValueByLabels(doc, ['endereco', 'endereço']) ||
    extractByRegex(pageText, [/endereco\s*:?\s*([a-z0-9,./-\s]+)/i])
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
  let items = tableInfo ? parseItemsFromTable(tableInfo.table, tableInfo.headers) : []
  if (items.length === 0) {
    items = parseItemsFromLayout(doc)
  }
  const totalAmount =
    parseNumber(totalAmountText) ||
    extractNumberByRegex(pageText, [
      /valor\s*total\s*:?\s*([\d.,]+)/i,
      /total\s*a\s*pagar\s*:?\s*([\d.,]+)/i,
    ]) ||
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
