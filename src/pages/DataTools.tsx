import { useRef, useState } from 'react'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'

const DataTools = () => {
  const { data, refresh } = useERPData()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const handleExport = () => {
    const payload = dataService.exportJson()
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'umoya_erp_data.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus('Backup gerado com sucesso.')
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const text = await file.text()
      dataService.importJson(text)
      refresh()
      setStatus('Dados importados com sucesso.')
    } catch {
      setStatus('Falha ao importar. Verifique se o JSON esta valido.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="data-tools">
      <div className="data-tools__header">
        <h1 className="data-tools__title">Importar e Exportar</h1>
        <p className="data-tools__subtitle">
          Gerencie backups e migre dados com seguranca.
        </p>
      </div>

      <div className="data-tools__grid">
        <div className="data-tools__panel">
          <h2>Backup rapido</h2>
          <p>Exporte todos os dados do ERP em um unico JSON.</p>
          <button className="button button--primary" type="button" onClick={handleExport}>
            Exportar JSON
          </button>
        </div>

        <div className="data-tools__panel">
          <h2>Restaurar dados</h2>
          <p>Importe um arquivo JSON previamente exportado.</p>
          <button className="button button--ghost" type="button" onClick={handleImportClick}>
            Importar JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="data-tools__file"
            onChange={handleFileChange}
          />
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
        </div>
        {status && <p className="data-tools__status">{status}</p>}
      </div>
    </section>
  )
}

export default DataTools
