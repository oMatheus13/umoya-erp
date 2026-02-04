import { Page, PageHeader } from '../../components/ui'
import type { SidebarMode } from '../../types/ui'

type ConfiguracoesProps = {
  sidebarMode: SidebarMode
  onSidebarModeChange: (mode: SidebarMode) => void
}

const Configuracoes = ({ sidebarMode, onSidebarModeChange }: ConfiguracoesProps) => {
  const options: Array<{
    id: SidebarMode
    title: string
    description: string
  }> = [
    {
      id: 'expanded',
      title: 'Sempre expandida',
      description: 'Mostra o menu completo o tempo todo.',
    },
    {
      id: 'collapsed',
      title: 'Sempre minimizada',
      description: 'Mostra apenas os icones.',
    },
    {
      id: 'hover',
      title: 'Abrir ao passar o mouse',
      description: 'Mantem minimizada e expande no hover.',
    },
  ]

  return (
    <Page className="configuracoes">
      <PageHeader title="Configuracoes" />

      <div className="configuracoes__grid">
        <div className="panel configuracoes__panel">
          <div className="configuracoes__panel-header">
            <div>
              <h2>Barra lateral</h2>
              <p>Escolha como deseja navegar pelo sistema.</p>
            </div>
          </div>

          <div className="configuracoes__options">
            {options.map((option) => (
              <label
                key={option.id}
                className={`configuracoes__option${
                  sidebarMode === option.id ? ' configuracoes__option--active' : ''
                }`}
              >
                <input
                  className="configuracoes__radio"
                  type="radio"
                  name="sidebar-mode"
                  value={option.id}
                  checked={sidebarMode === option.id}
                  onChange={() => onSidebarModeChange(option.id)}
                />
                <div className="configuracoes__option-content">
                  <span className="configuracoes__option-title">{option.title}</span>
                  <span className="configuracoes__option-desc">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}

export default Configuracoes
