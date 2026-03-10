import { useMemo } from 'react'
import { Page, PageHeader } from '@ui/components'
import { useERPData } from '@shared/store/appStore'
import type { PurchaseRecord } from '@shared/types/erp'
import { formatCurrency, formatDateShort } from '@shared/utils/format'

const RelatoriosHistorico = () => {
  const { data } = useERPData()

  const suppliersById = useMemo(
    () => new Map(data.fornecedores.map((supplier) => [supplier.id, supplier.name])),
    [data.fornecedores],
  )
  const cashboxesById = useMemo(
    () => new Map(data.caixas.map((cashbox) => [cashbox.id, cashbox.name])),
    [data.caixas],
  )

  const purchases = useMemo(
    () =>
      [...data.comprasHistorico].sort((a, b) => {
        const aDate = new Date(a.purchaseDate ?? a.createdAt).getTime()
        const bDate = new Date(b.purchaseDate ?? b.createdAt).getTime()
        return bDate - aDate
      }),
    [data.comprasHistorico],
  )

  const expenses = useMemo(
    () =>
      [...data.financeiro]
        .filter((entry) => entry.type === 'saida')
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [data.financeiro],
  )

  const getSupplierName = (id?: string) => suppliersById.get(id ?? '') ?? 'Sem fornecedor'
  const getCashboxName = (id: string) => cashboxesById.get(id) ?? 'Caixa'

  const buildPurchaseSummary = (purchase: PurchaseRecord) => {
    if (purchase.items.length === 0) {
      return '-'
    }
    const labels = purchase.items.map((item) => item.description)
    if (labels.length <= 2) {
      return labels.join(' + ')
    }
    return `${labels[0]} +${labels.length - 1}`
  }

  const getPurchaseDate = (purchase: PurchaseRecord) =>
    formatDateShort(purchase.purchaseDate ?? purchase.createdAt)

  const getPurchaseSource = (purchase: PurchaseRecord) =>
    purchase.source === 'nfce' ? 'NFC-e' : 'Manual'

  return (
    <Page className="relatorios">
      <PageHeader subtitle="Historico completo de compras e despesas" />

      <section className="panel panel--full">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Historico de compras</h2>
            <p className="panel__subtitle">Compras manuais e NFC-e em ordem de data</p>
          </div>
          <span className="panel__meta">{purchases.length} compras</span>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Data</th>
                <th>Fornecedor</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="table__empty">
                    Nenhuma compra registrada.
                  </td>
                </tr>
              )}
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="table__cell--mobile-hide">{getPurchaseDate(purchase)}</td>
                  <td className="table__cell--mobile-hide">
                    {getSupplierName(purchase.supplierId)}
                  </td>
                  <td className="table__cell--truncate">
                    <div className="table__stack">
                      <strong>{buildPurchaseSummary(purchase)}</strong>
                      <span className="table__sub table__sub--mobile">
                        {getSupplierName(purchase.supplierId)}
                      </span>
                      <span className="table__sub table__sub--mobile">
                        {getPurchaseDate(purchase)}
                      </span>
                      <span className="table__sub table__sub--mobile">
                        {formatCurrency(purchase.total)}
                      </span>
                    </div>
                  </td>
                  <td className="table__cell--mobile-hide">
                    {formatCurrency(purchase.total)}
                  </td>
                  <td className="table__cell--mobile-hide">
                    {getPurchaseSource(purchase)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Historico de despesas</h2>
            <p className="panel__subtitle">Todas as saidas do financeiro por registro</p>
          </div>
          <span className="panel__meta">{expenses.length} despesas</span>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Data</th>
                <th>Descricao</th>
                <th>Categoria</th>
                <th>Caixa</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="table__empty">
                    Nenhuma despesa registrada.
                  </td>
                </tr>
              )}
              {expenses.map((entry) => (
                <tr key={entry.id}>
                  <td className="table__cell--mobile-hide">
                    {formatDateShort(entry.createdAt)}
                  </td>
                  <td className="table__cell--truncate">
                    <div className="table__stack">
                      <strong>{entry.description}</strong>
                      <span className="table__sub table__sub--mobile">
                        {entry.category ?? 'Sem categoria'}
                      </span>
                      <span className="table__sub table__sub--mobile">
                        {formatDateShort(entry.createdAt)}
                      </span>
                      <span className="table__sub table__sub--mobile">
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                  </td>
                  <td className="table__cell--mobile-hide">{entry.category ?? '-'}</td>
                  <td className="table__cell--mobile-hide">
                    {getCashboxName(entry.cashboxId)}
                  </td>
                  <td className="table__cell--mobile-hide">
                    {formatCurrency(entry.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  )
}

export default RelatoriosHistorico
