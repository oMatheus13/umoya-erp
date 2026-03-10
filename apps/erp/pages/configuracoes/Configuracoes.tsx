import { Page, PageHeader } from '@ui/components'
import type { SidebarMode } from '@shared/types/ui'

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
      <PageHeader />

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Barra lateral</h2>
            <p className="panel__subtitle">Escolha como deseja navegar pelo sistema.</p>
          </div>
        </div>

        <div className="list">
          {options.map((option) => {
            const inputId = `sidebar-mode-${option.id}`
            return (
              <div
                key={option.id}
                className={`list__item list__item--center${
                  sidebarMode === option.id ? ' list__item--active' : ''
                }`}
              >
                <div>
                  <strong>{option.title}</strong>
                  <span className="list__meta">{option.description}</span>
                </div>
                <label className="toggle" htmlFor={inputId}>
                  <input
                    id={inputId}
                    type="radio"
                    name="sidebar-mode"
                    value={option.id}
                    checked={sidebarMode === option.id}
                    onChange={() => onSidebarModeChange(option.id)}
                  />
                  <span className="toggle__track" aria-hidden="true">
                    <span className="toggle__thumb" />
                  </span>
                  <span className="toggle__label sr-only">Selecionar</span>
                </label>
              </div>
            )
          })}
        </div>
      </section>
    </Page>
  )
}

export default Configuracoes
