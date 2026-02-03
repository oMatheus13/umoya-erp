import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useERPData } from '../store/appStore'

type TopbarProps = {
  breadcrumbs: string[]
  userName?: string
  userRoleLabel?: string
  userAvatarUrl?: string
  userAvatarColor?: string
  onLogout?: () => void
  onMenuToggle?: () => void
  isMenuOpen?: boolean
  readOnly?: boolean
  isSensitiveHidden?: boolean
  onSensitiveToggle?: () => void
  onProfileOpen?: () => void
  onNavigate?: (pageId: string) => void
  canView?: (pageId: string) => boolean
}

type SearchItem = {
  id: string
  title: string
  subtitle?: string
  page: string
  category: string
  keywords: string
}

type SearchInput = Omit<SearchItem, 'keywords'> & {
  keywords?: Array<string | undefined>
}

type NotificationItem = {
  id: string
  title: string
  description?: string
  page?: string
  tone?: 'info' | 'warning' | 'alert'
}

const Topbar = ({
  breadcrumbs: _breadcrumbs,
  userName,
  userRoleLabel,
  userAvatarUrl,
  userAvatarColor,
  onLogout,
  onMenuToggle,
  isMenuOpen,
  readOnly,
  isSensitiveHidden,
  onSensitiveToggle,
  onProfileOpen,
  onNavigate,
  canView,
}: TopbarProps) => {
  const { data } = useERPData()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null)
  const avatarFallback = userName?.[0] ?? 'U'
  const avatarPalette: Record<string, string> = {
    lime: 'var(--color-lime)',
    ink: 'var(--color-ink)',
    sand: '#d9d3c7',
    night: '#1b1f2a',
  }
  const avatarBackground = userAvatarColor
    ? avatarPalette[userAvatarColor] ?? userAvatarColor
    : 'var(--color-ink)'

  useEffect(() => {
    if (!isSearchOpen && !isNotificationsOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false)
        setIsNotificationsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen, isNotificationsOpen])

  useEffect(() => {
    if (!isNotificationsOpen) {
      return
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        notificationsRef.current?.contains(target) ||
        notificationsButtonRef.current?.contains(target)
      ) {
        return
      }
      setIsNotificationsOpen(false)
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [isNotificationsOpen])

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = []
    const allowPage = (page: string) => (canView ? canView(page) : true)
    const pushItem = (item: SearchInput) => {
      if (!allowPage(item.page)) {
        return
      }
      const keywords = [item.title, item.subtitle, ...(item.keywords ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      items.push({ ...item, keywords })
    }

    data.clientes.forEach((client) => {
      pushItem({
        id: client.id,
        title: client.name,
        subtitle: client.document ?? client.phone ?? client.email,
        page: 'clientes',
        category: 'Clientes',
        keywords: [client.city, client.notes],
      })
      client.obras?.forEach((obra) => {
        pushItem({
          id: obra.id,
          title: obra.name,
          subtitle: obra.address,
          page: 'clientes',
          category: 'Obras',
          keywords: [obra.city, client.name],
        })
      })
    })

    data.produtos.forEach((product) => {
      pushItem({
        id: product.id,
        title: product.name,
        subtitle: product.sku ? `SKU ${product.sku}` : undefined,
        page: 'produtos',
        category: 'Produtos',
        keywords: [product.dimensions, product.sku],
      })
    })

    data.materiais.forEach((material) => {
      pushItem({
        id: material.id,
        title: material.name,
        subtitle: material.unit ? `Unidade ${material.unit}` : undefined,
        page: 'cadastros-materiais',
        category: 'Materia-prima',
      })
    })

    data.fornecedores.forEach((supplier) => {
      pushItem({
        id: supplier.id,
        title: supplier.name,
        subtitle: supplier.contact ?? supplier.phone ?? supplier.email,
        page: 'fornecedores',
        category: 'Fornecedores',
        keywords: [supplier.document, supplier.city],
      })
    })

    data.orcamentos.forEach((quote) => {
      const client = data.clientes.find((item) => item.id === quote.clientId)
      pushItem({
        id: quote.id,
        title: `Orcamento #${quote.id.slice(-6)}`,
        subtitle: client?.name ?? 'Cliente',
        page: 'orcamentos',
        category: 'Orcamentos',
        keywords: [quote.status],
      })
    })

    data.pedidos.forEach((order) => {
      const client = data.clientes.find((item) => item.id === order.clientId)
      pushItem({
        id: order.id,
        title: `Pedido #${order.id.slice(-6)}`,
        subtitle: client?.name ?? 'Cliente',
        page: 'pedidos',
        category: 'Pedidos',
        keywords: [order.status],
      })
    })

    data.ordensProducao.forEach((order) => {
      const product = data.produtos.find((item) => item.id === order.productId)
      pushItem({
        id: order.id,
        title: `OP #${order.id.slice(-5)}`,
        subtitle: product?.name ?? 'Produto',
        page: 'producao',
        category: 'Producao',
        keywords: [order.status],
      })
    })

    data.entregas.forEach((delivery) => {
      const client = data.clientes.find((item) => item.id === delivery.clientId)
      pushItem({
        id: delivery.id,
        title: `Entrega #${delivery.id.slice(-5)}`,
        subtitle: client?.name ?? 'Cliente',
        page: 'entregas',
        category: 'Entregas',
        keywords: [delivery.status, delivery.address],
      })
    })

    data.funcionarios.forEach((employee) => {
      pushItem({
        id: employee.id,
        title: employee.name,
        subtitle: employee.cpf ? `CPF ${employee.cpf}` : undefined,
        page: 'funcionarios',
        category: 'Funcionarios',
      })
    })

    return items
  }, [
    data.clientes,
    data.entregas,
    data.fornecedores,
    data.funcionarios,
    data.materiais,
    data.ordensProducao,
    data.orcamentos,
    data.pedidos,
    data.produtos,
    canView,
  ])

  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = useMemo(
    () =>
      normalizedQuery
        ? searchItems
            .filter((item) => item.keywords.includes(normalizedQuery))
            .slice(0, 8)
        : [],
    [normalizedQuery, searchItems],
  )

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = []
    const allowPage = (page: string) => (canView ? canView(page) : true)
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const lowStock = data.materiais.filter(
      (material) =>
        material.minStock !== undefined && (material.stock ?? 0) <= material.minStock,
    )
    if (lowStock.length > 0 && allowPage('estoque-materiais')) {
      const names = lowStock.slice(0, 3).map((item) => item.name).join(', ')
      const suffix = lowStock.length > 3 ? ` +${lowStock.length - 3}` : ''
      items.push({
        id: 'low-stock',
        title: 'Materia-prima baixa',
        description: `${names}${suffix}`,
        page: 'estoque-materiais',
        tone: 'alert',
      })
    }

    const pendingOrders = data.pedidos.filter((order) => order.status === 'aguardando_pagamento')
    if (pendingOrders.length > 0 && allowPage('pedidos')) {
      items.push({
        id: 'pending-orders',
        title: 'Pedidos aguardando pagamento',
        description: `${pendingOrders.length} pedido(s) pendentes`,
        page: 'pedidos',
        tone: 'warning',
      })
    }

    const overdueQuotes = data.orcamentos.filter(
      (quote) =>
        quote.status !== 'aprovado' &&
        quote.status !== 'recusado' &&
        new Date(quote.validUntil).getTime() < startOfDay.getTime(),
    )
    if (overdueQuotes.length > 0 && allowPage('orcamentos')) {
      items.push({
        id: 'overdue-quotes',
        title: 'Orcamentos vencidos',
        description: `${overdueQuotes.length} orcamento(s)`,
        page: 'orcamentos',
        tone: 'warning',
      })
    }

    const pendingDeliveries = data.entregas.filter((delivery) => {
      if (delivery.status === 'entregue') return false
      if (!delivery.scheduledAt) return false
      return new Date(delivery.scheduledAt).getTime() < startOfDay.getTime()
    })
    if (pendingDeliveries.length > 0 && allowPage('entregas')) {
      items.push({
        id: 'overdue-deliveries',
        title: 'Entregas atrasadas',
        description: `${pendingDeliveries.length} entrega(s) pendentes`,
        page: 'entregas',
        tone: 'alert',
      })
    }

    const pendingFiscal = data.fiscalNotas.filter((note) => note.status === 'pendente')
    if (pendingFiscal.length > 0 && allowPage('fiscal')) {
      items.push({
        id: 'pending-fiscal',
        title: 'Notas fiscais pendentes',
        description: `${pendingFiscal.length} documento(s)`,
        page: 'fiscal',
        tone: 'info',
      })
    }

    const openQuality = data.qualidadeChecks.filter((check) => check.status === 'aberto')
    if (openQuality.length > 0 && allowPage('qualidade')) {
      items.push({
        id: 'quality-open',
        title: 'Falhas em aberto',
        description: `${openQuality.length} apontamento(s)`,
        page: 'qualidade',
        tone: 'warning',
      })
    }

    const openMaintenance = data.manutencoes.filter((entry) => entry.status === 'aberta')
    if (openMaintenance.length > 0 && allowPage('qualidade')) {
      items.push({
        id: 'maintenance-open',
        title: 'Manutencoes em aberto',
        description: `${openMaintenance.length} equipamento(s)`,
        page: 'qualidade',
        tone: 'info',
      })
    }

    return items
  }, [
    data.entregas,
    data.fiscalNotas,
    data.manutencoes,
    data.materiais,
    data.orcamentos,
    data.pedidos,
    data.qualidadeChecks,
    canView,
  ])

  const handleResultSelect = (item: SearchItem) => {
    if (onNavigate) {
      onNavigate(item.page)
    }
    setQuery('')
    setIsSearchOpen(false)
    setIsSearchFocused(false)
  }

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && searchResults.length > 0) {
      event.preventDefault()
      handleResultSelect(searchResults[0])
    }
  }

  const renderSearchResults = (variant: 'dropdown' | 'overlay') => {
    if (!normalizedQuery) {
      return null
    }
    return (
      <div
        className={`topbar__search-results ${
          variant === 'overlay' ? 'topbar__search-results--overlay' : ''
        }`}
        onMouseDown={(event) => event.preventDefault()}
      >
        {searchResults.length === 0 ? (
          <div className="topbar__search-empty">Nenhum resultado encontrado.</div>
        ) : (
          searchResults.map((item) => (
            <button
              key={item.id}
              type="button"
              className="topbar__search-result"
              onClick={() => handleResultSelect(item)}
            >
              <div className="topbar__search-result-text">
                <span className="topbar__search-result-title">{item.title}</span>
                {item.subtitle && (
                  <span className="topbar__search-result-meta">{item.subtitle}</span>
                )}
              </div>
              <span className="topbar__search-result-tag">{item.category}</span>
            </button>
          ))
        )}
      </div>
    )
  }
  return (
    <header className="topbar">
      <div className="topbar__left">
        {onMenuToggle && (
          <button
            className="topbar__menu"
            type="button"
            onClick={onMenuToggle}
            aria-label="Abrir menu"
            aria-expanded={isMenuOpen}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              menu
            </span>
          </button>
        )}
        <button
          className="topbar__search-toggle"
          type="button"
          onClick={() => {
            setIsSearchOpen(true)
            setIsNotificationsOpen(false)
          }}
          aria-label="Buscar no ERP"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
        </button>
        <div className="topbar__search">
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            placeholder="Buscar no ERP"
            aria-label="Buscar no ERP"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onKeyDown={handleSearchKeyDown}
          />
          {isSearchFocused && renderSearchResults('dropdown')}
        </div>
      </div>
      <div className="topbar__right">
        {readOnly && <span className="topbar__badge">Somente leitura</span>}
        <button
          className="topbar__icon"
          type="button"
          onClick={onSensitiveToggle}
          aria-label={isSensitiveHidden ? 'Mostrar informacoes' : 'Ocultar informacoes'}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {isSensitiveHidden ? 'visibility_off' : 'visibility'}
          </span>
        </button>
        <div className="topbar__notifications" ref={notificationsRef}>
          <button
            className="topbar__icon"
            type="button"
            aria-label="Notificacoes"
            onClick={() => {
              setIsNotificationsOpen((prev) => !prev)
              setIsSearchOpen(false)
            }}
            ref={notificationsButtonRef}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              notifications
            </span>
            {notifications.length > 0 && (
              <span className="topbar__notification-count">{notifications.length}</span>
            )}
          </button>
          {isNotificationsOpen && (
            <div className="topbar__notifications-panel" role="dialog" aria-modal="true">
              <div className="topbar__notifications-header">
                <strong>Notificacoes</strong>
                <button
                  className="topbar__notifications-close"
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  aria-label="Fechar notificacoes"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
              <div className="topbar__notifications-list">
                {notifications.length === 0 && (
                  <div className="topbar__notification-empty">Sem notificacoes no momento.</div>
                )}
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`topbar__notification-item${
                      item.tone ? ` topbar__notification-item--${item.tone}` : ''
                    }`}
                    onClick={() => {
                      if (item.page && onNavigate) {
                        onNavigate(item.page)
                      }
                      setIsNotificationsOpen(false)
                    }}
                  >
                    <span className="topbar__notification-title">{item.title}</span>
                    {item.description && (
                      <span className="topbar__notification-meta">{item.description}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="topbar__profile">
          <button className="topbar__profile-main" type="button" onClick={onProfileOpen}>
            {userAvatarUrl ? (
              <img className="topbar__avatar" src={userAvatarUrl} alt={userName ?? 'Usuario'} />
            ) : (
              <span className="topbar__avatar" style={{ background: avatarBackground }}>
                {avatarFallback}
              </span>
            )}
            <span className="topbar__profile-text">
              <span className="topbar__profile-name">{userName ?? 'Usuario'}</span>
              <span className="topbar__profile-role">{userRoleLabel ?? 'Equipe'}</span>
            </span>
          </button>
          {onLogout && (
            <button className="topbar__logout-icon" type="button" onClick={onLogout}>
              <span className="material-symbols-outlined" aria-hidden="true">
                logout
              </span>
            </button>
          )}
        </div>
      </div>
      {isSearchOpen && (
        <div
          className="topbar__search-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsSearchOpen(false)}
        >
          <div className="topbar__search-surface" onClick={(event) => event.stopPropagation()}>
            <span className="material-symbols-outlined" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              placeholder="Buscar no ERP"
              aria-label="Buscar no ERP"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            <button
              className="topbar__search-close"
              type="button"
              onClick={() => setIsSearchOpen(false)}
              aria-label="Fechar busca"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>
          {renderSearchResults('overlay')}
        </div>
      )}
    </header>
  )
}

export default Topbar
