import { useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { createEmptyState } from '../../services/storage'
import { useERPData } from '../../store/appStore'

const DataTools = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [isResetOpen, setIsResetOpen] = useState(false)

  const handleReset = () => {
    const payload = dataService.getAll()
    const next = createEmptyState()
    next.usuarios = payload.usuarios
    dataService.replaceAll(next)
    refresh()
    setStatus('Dados resetados com sucesso.')
    setIsResetOpen(false)
  }

  return (
    <Page className="data-tools">
      <PageHeader />

      <div className="grid grid--stack">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Resetar dados</h2>
              <p className="panel__subtitle">
                Apaga cadastros e movimentacoes do ERP. Contas de acesso permanecem ativas.
              </p>
            </div>
            <div className="panel__actions">
              <button
                className="button button--danger"
                type="button"
                onClick={() => setIsResetOpen(true)}
              >
                Resetar tudo
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Resumo atual</h2>
            </div>
          </div>
          <div className="panel__items">
            <div className="panel__item">
              <span className="panel__item-label">Produtos</span>
              <strong className="panel__item-value">{data.produtos.length}</strong>
            </div>
            <div className="panel__item">
              <span className="panel__item-label">Clientes</span>
              <strong className="panel__item-value">{data.clientes.length}</strong>
            </div>
            <div className="panel__item">
              <span className="panel__item-label">Pedidos</span>
              <strong className="panel__item-value">{data.pedidos.length}</strong>
            </div>
            <div className="panel__item">
              <span className="panel__item-label">Financeiro</span>
              <strong className="panel__item-value">{data.financeiro.length}</strong>
            </div>
            <div className="panel__item">
              <span className="panel__item-label">Funcionarios</span>
              <strong className="panel__item-value">{data.funcionarios.length}</strong>
            </div>
            <div className="panel__item">
              <span className="panel__item-label">Usuarios</span>
              <strong className="panel__item-value">{data.usuarios.length}</strong>
            </div>
          </div>
          {status && <p className="form__status">{status}</p>}
        </section>
      </div>
      <ConfirmDialog
        open={isResetOpen}
        title="Resetar dados do ERP?"
        description="Todos os cadastros e movimentacoes serao apagados. Contas de acesso permanecem."
        onClose={() => setIsResetOpen(false)}
        onConfirm={handleReset}
      />
    </Page>
  )
}

export default DataTools
