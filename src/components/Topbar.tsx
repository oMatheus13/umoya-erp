import logotipo from '../assets/brand/logotipo.svg'

type TopbarProps = {
  breadcrumbs: string[]
}

const Topbar = ({ breadcrumbs }: TopbarProps) => {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img className="topbar__logo" src={logotipo} alt="Umoya ERP" />
        <div className="topbar__breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="topbar__crumb">
              {crumb}
              {index < breadcrumbs.length - 1 && (
                <span className="topbar__separator">/</span>
              )}
            </span>
          ))}
        </div>
      </div>
      <div className="topbar__actions">
        <div className="topbar__search">
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
          <input type="search" placeholder="Buscar no ERP" aria-label="Buscar no ERP" />
        </div>
        <span className="material-symbols-outlined" aria-hidden="true">
          notifications
        </span>
        <span className="material-symbols-outlined" aria-hidden="true">
          account_circle
        </span>
      </div>
    </header>
  )
}

export default Topbar
