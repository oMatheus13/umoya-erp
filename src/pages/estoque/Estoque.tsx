import { useMemo } from 'react'
import { Page, PageHeader } from '../../components/ui'
import { useERPData } from '../../store/appStore'

const Estoque = () => {
  const { data } = useERPData()

  const variants = useMemo(
    () =>
      data.produtos.flatMap((product) => {
        const entries = (product.variants ?? []).map((variant) => ({
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          variantName: variant.name,
          variantLocked: variant.locked ?? false,
          stock: variant.stock ?? 0,
        }))
        const hasLinearVariants =
          product.unit === 'metro_linear' && (product.variants ?? []).length > 0
        if (product.hasVariants || hasLinearVariants) {
          return entries
        }
        return [
          {
            productId: product.id,
            productName: product.name,
            variantId: `${product.id}-base`,
            variantName: '',
            variantLocked: false,
            stock: product.stock ?? 0,
          },
        ]
      }),
    [data.produtos],
  )

  const totalSkus = variants.length
  const totalStock = variants.reduce((acc, item) => acc + item.stock, 0)
  const outOfStock = variants.filter((item) => item.stock <= 0)
  const lowStock = variants.filter((item) => item.stock > 0 && item.stock <= 5)

  const criticalItems = useMemo(() => {
    const list = [
      ...outOfStock.map((item) => ({ ...item, status: 'Sem estoque' })),
      ...lowStock.map((item) => ({ ...item, status: 'Baixo' })),
    ]
    return list.slice(0, 6)
  }, [lowStock, outOfStock])

  const topStock = useMemo(
    () => [...variants].sort((a, b) => b.stock - a.stock).slice(0, 6),
    [variants],
  )

  const getLabel = (item: typeof variants[number]) =>
    item.variantName
      ? item.variantLocked
        ? `${item.productName} ${item.variantName}`
        : `${item.productName} • ${item.variantName}`
      : item.productName

  return (
    <Page className="estoque">
      <PageHeader />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Itens em estoque</span>
          <strong className="summary__value">{totalStock}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">SKUs ativos</span>
          <strong className="summary__value">{totalSkus}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Estoque critico</span>
          <strong className="summary__value">{criticalItems.length}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Sem estoque</span>
          <strong className="summary__value">{outOfStock.length}</strong>
        </article>
      </div>

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Alertas de estoque</h2>
              <p className="panel__subtitle">Itens que exigem reposicao</p>
            </div>
          </div>
          <div className="list">
            {criticalItems.length === 0 && (
              <div className="list__empty">Nenhum alerta de estoque ativo.</div>
            )}
            {criticalItems.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="list__item">
                <div>
                  <strong>{getLabel(item)}</strong>
                  <span className="list__meta">{item.status}</span>
                </div>
                <strong>{item.stock}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Maiores saldos</h2>
              <p className="panel__subtitle">Produtos com maior quantidade</p>
            </div>
          </div>
          <div className="list">
            {topStock.length === 0 && <div className="list__empty">Nenhum item cadastrado.</div>}
            {topStock.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="list__item">
                <span>{getLabel(item)}</span>
                <strong>{item.stock}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  )
}

export default Estoque
