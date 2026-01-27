import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { dataService } from '../services/dataService'
import { createEmptyState } from '../services/storage'
import { useERPData } from '../store/appStore'

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
    <section className="data-tools">
      <header className="data-tools__header">
        <div className="data-tools__headline">
          <span className="data-tools__eyebrow">Admin</span>
          <h1 className="data-tools__title">Dados do sistema</h1>
          <p className="data-tools__subtitle">
            Reinicie o ambiente de testes e acompanhe o resumo atual.
          </p>
        </div>
      </header>

      <div className="data-tools__grid">
        <div className="data-tools__panel">
          <h2>Resetar dados</h2>
          <p>
            Apaga cadastros e movimentacoes do ERP. Contas de acesso permanecem ativas.
          </p>
          <button
            className="button button--danger"
            type="button"
            onClick={() => setIsResetOpen(true)}
          >
            Resetar tudo
          </button>
        </div>
      </div>

      <div className="data-tools__panel data-tools__panel--wide">
        <h2>Resumo atual</h2>
        <div className="data-tools__stats">
          <div>
            <span>Produtos</span>
            <strong>{data.produtos.length}</strong>
          </div>
          <div>
            <span>Clientes</span>
            <strong>{data.clientes.length}</strong>
          </div>
          <div>
            <span>Pedidos</span>
            <strong>{data.pedidos.length}</strong>
          </div>
          <div>
            <span>Financeiro</span>
            <strong>{data.financeiro.length}</strong>
          </div>
          <div>
            <span>Funcionarios</span>
            <strong>{data.funcionarios.length}</strong>
          </div>
          <div>
            <span>Usuarios</span>
            <strong>{data.usuarios.length}</strong>
          </div>
        </div>
        {status && <p className="data-tools__status">{status}</p>}
      </div>
      <ConfirmDialog
        open={isResetOpen}
        title="Resetar dados do ERP?"
        description="Todos os cadastros e movimentacoes serao apagados. Contas de acesso permanecem."
        onClose={() => setIsResetOpen(false)}
        onConfirm={handleReset}
      />
    </section>
  )
}

export default DataTools
