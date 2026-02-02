import { useMemo } from 'react'
import { useERPData } from '../store/appStore'

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
        const shouldUseProductStock = !product.hasVariants && !hasLinearVariants
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
    <section className="estoque">
      <header className="estoque__header">
        <div className="estoque__headline">
          <span className="estoque__eyebrow">Estoque</span>
          <h1 className="estoque__title">Estoque consolidado</h1>
          <p className="estoque__subtitle">
            Controle rapido de saldos, alertas e itens criticos.
          </p>
        </div>
      </header>

      <div className="estoque__summary">
        <article className="estoque__stat">
          <span className="estoque__stat-label">Itens em estoque</span>
          <strong className="estoque__stat-value">{totalStock}</strong>
        </article>
        <article className="estoque__stat">
          <span className="estoque__stat-label">SKUs ativos</span>
          <strong className="estoque__stat-value">{totalSkus}</strong>
        </article>
        <article className="estoque__stat">
          <span className="estoque__stat-label">Estoque critico</span>
          <strong className="estoque__stat-value">{criticalItems.length}</strong>
        </article>
        <article className="estoque__stat">
          <span className="estoque__stat-label">Sem estoque</span>
          <strong className="estoque__stat-value">{outOfStock.length}</strong>
        </article>
      </div>

      <div className="estoque__grid">
        <section className="estoque__panel">
          <div className="estoque__panel-header">
            <div>
              <h2 className="estoque__panel-title">Alertas de estoque</h2>
              <p className="estoque__panel-subtitle">Itens que exigem reposicao</p>
            </div>
          </div>
          <div className="estoque__list">
            {criticalItems.length === 0 && (
              <div className="estoque__empty">Nenhum alerta de estoque ativo.</div>
            )}
            {criticalItems.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="estoque__list-item">
                <div>
                  <strong>{getLabel(item)}</strong>
                  <span className="estoque__list-meta">{item.status}</span>
                </div>
                <strong>{item.stock}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="estoque__panel">
          <div className="estoque__panel-header">
            <div>
              <h2 className="estoque__panel-title">Maiores saldos</h2>
              <p className="estoque__panel-subtitle">Produtos com maior quantidade</p>
            </div>
          </div>
          <div className="estoque__list">
            {topStock.length === 0 && <div className="estoque__empty">Nenhum item cadastrado.</div>}
            {topStock.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="estoque__list-item">
                <span>{getLabel(item)}</span>
                <strong>{item.stock}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

    </section>
  )
}

export default Estoque
