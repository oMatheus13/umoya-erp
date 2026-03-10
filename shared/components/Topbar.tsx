import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import QuickNotice, { type QuickNoticeTone } from './QuickNotice'
import { NAVIGATION_GROUPS } from '@erp/data/navigation'
import { useERPData } from '@shared/store/appStore'
import type { PageIntentAction } from '@shared/types/ui'
import { resolveOrderInternalCode } from '@shared/utils/orderCode'
import { formatSkuWithVariant } from '@shared/utils/sku'

export type TopbarSearchItemInput = {
  id: string
  title: string
  subtitle?: string
  page?: string
  category: string
  intent?: PageIntentAction
  keywords?: Array<string | undefined>
}

export type TopbarSearchItem = Omit<TopbarSearchItemInput, 'keywords'> & {
  keywords: string
}

type TopbarProps = {
  breadcrumbs: string[]
  brand?: ReactNode
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
  onNavigate?: (pageId: string, intent?: PageIntentAction) => void
  canView?: (pageId: string) => boolean
  searchItems?: TopbarSearchItemInput[]
  onSearchSelect?: (item: TopbarSearchItem) => void
  searchPlaceholder?: string
  showSensitiveToggle?: boolean
  showNotifications?: boolean
  showDevTools?: boolean
}

type SearchItem = TopbarSearchItem

type NotificationItem = {
  id: string
  title: string
  description?: string
  page?: string
  tone?: 'info' | 'warning' | 'alert'
}

type DevToast = {
  message: string
  tone: QuickNoticeTone
  nonce: number
}

const Topbar = ({
  brand,
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
  searchItems: searchItemsOverride,
  onSearchSelect,
  searchPlaceholder = 'Pesquisar',
  showSensitiveToggle = true,
  showNotifications = true,
  showDevTools = false,
}: TopbarProps) => {
  const { data } = useERPData()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false)
  const [devToast, setDevToast] = useState<DevToast | null>(null)
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null)
  const devToolsRef = useRef<HTMLDivElement | null>(null)
  const devToolsButtonRef = useRef<HTMLButtonElement | null>(null)
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
    if (!isSearchOpen && !isNotificationsOpen && !isDevToolsOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false)
        setIsNotificationsOpen(false)
        setIsDevToolsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen, isNotificationsOpen, isDevToolsOpen])

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

  useEffect(() => {
    if (!isDevToolsOpen) {
      return
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        devToolsRef.current?.contains(target) ||
        devToolsButtonRef.current?.contains(target)
      ) {
        return
      }
      setIsDevToolsOpen(false)
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [isDevToolsOpen])

  useEffect(() => {
    if (showDevTools) {
      return
    }
    setIsDevToolsOpen(false)
  }, [showDevTools])

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = []
    const allowPage = (page: string) => (canView ? canView(page) : true)
    const pushItem = (item: TopbarSearchItemInput) => {
      if (item.page && !allowPage(item.page)) {
        return
      }
      const keywords = [item.title, item.subtitle, ...(item.keywords ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      items.push({ ...item, keywords })
    }

    const navigationKeywords: Record<string, string[]> = {
      financeiro: ['caixa', 'caixas', 'fluxo de caixa'],
    }

    if (searchItemsOverride) {
      searchItemsOverride.forEach((item) => pushItem(item))
      return items
    }

    NAVIGATION_GROUPS.forEach((group) => {
      if (group.type === 'section') {
        pushItem({
          id: `nav-${group.id}`,
          title: group.label,
          subtitle: 'Seção',
          page: group.id,
          category: 'Sistema',
          keywords: [group.label, group.id, ...(navigationKeywords[group.id] ?? [])],
        })
        return
      }
      group.items.forEach((item) => {
        pushItem({
          id: `nav-${item.id}`,
          title: item.label,
          subtitle: group.label,
          page: item.id,
          category: 'Sistema',
          keywords: [
            item.label,
            item.id,
            group.label,
            ...(navigationKeywords[item.id] ?? []),
          ],
        })
      })
    })

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
      product.variants?.forEach((variant) => {
        const variantSku = variant.sku?.trim() ?? ''
        const combinedSku = variantSku ? formatSkuWithVariant(product.sku, variantSku) : '-'
        const variantTitle =
          variant.name?.trim() || (combinedSku !== '-' ? combinedSku : 'Variação')
        const variantSubtitle =
          combinedSku !== '-' ? `${product.name} • SKU ${combinedSku}` : product.name
        pushItem({
          id: `variant-${product.id}-${variant.id}`,
          title: variantTitle,
          subtitle: variantSubtitle,
          page: 'produtos',
          category: 'Variações',
          intent: {
            type: 'open-variant',
            productId: product.id,
            variantId: variant.id,
          },
          keywords: [
            variant.name,
            product.name,
            product.sku,
            variantSku,
            combinedSku !== '-' ? combinedSku : undefined,
          ],
        })
      })
    })

    data.caixas.forEach((cashbox) => {
      pushItem({
        id: `cashbox-${cashbox.id}`,
        title: cashbox.name,
        subtitle: 'Caixa',
        page: 'financeiro',
        category: 'Caixas',
        keywords: [cashbox.id, cashbox.name, 'caixa', 'caixas'],
      })
    })

    data.materiais.forEach((material) => {
      pushItem({
        id: material.id,
        title: material.name,
        subtitle: material.unit ? `Unidade ${material.unit}` : undefined,
        page: 'cadastros-materiais',
        category: 'Matéria-prima',
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
        title: `Orçamento #${quote.id.slice(-6)}`,
        subtitle: client?.name ?? 'Cliente',
        page: 'orcamentos',
        category: 'Orçamentos',
        keywords: [quote.status],
      })
    })

    data.pedidos.forEach((order) => {
      const client = data.clientes.find((item) => item.id === order.clientId)
      pushItem({
        id: order.id,
        title: `Pedido #${resolveOrderInternalCode(order)}`,
        subtitle: client?.name ?? 'Cliente',
        page: 'pedidos',
        category: 'Pedidos',
        keywords: [order.status],
      })
    })

    data.ordensProducao.forEach((order) => {
      const product = data.produtos.find((item) => item.id === order.productId)
      const productionCode = order.code?.trim() || order.id.slice(-5)
      pushItem({
        id: order.id,
        title: `OP #${productionCode}`,
        subtitle: product?.name ?? 'Produto',
        page: 'producao',
        category: 'Produção',
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
        category: 'Funcionários',
      })
    })

    return items
  }, [
    data.caixas,
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
    searchItemsOverride,
  ])

  const normalizedQuery = query.trim().toLowerCase()
  const hasQuery = query.trim().length > 0
  const matchedSearchItems = useMemo(
    () =>
      normalizedQuery
        ? searchItems.filter((item) => item.keywords.includes(normalizedQuery))
        : [],
    [normalizedQuery, searchItems],
  )
  const searchResults = useMemo(
    () => matchedSearchItems.slice(0, 8),
    [matchedSearchItems],
  )
  const overlayResults = useMemo(
    () => matchedSearchItems.slice(0, 20),
    [matchedSearchItems],
  )
  const searchResultsCount = matchedSearchItems.length

  const notifications = useMemo<NotificationItem[]>(() => {
    if (!showNotifications) {
      return []
    }
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
        title: 'Matéria-prima baixa',
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
        title: 'Orçamentos vencidos',
        description: `${overdueQuotes.length} orçamento(s)`,
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
        title: 'Manutenções em aberto',
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
    showNotifications,
  ])
  const hasUrgentNotifications = notifications.some((item) => item.tone === 'alert')
  const notificationIcon =
    hasUrgentNotifications
      ? 'notification_important'
      : notifications.length > 0
        ? 'notifications_active'
        : 'notifications'

  const handleResultSelect = (item: SearchItem) => {
    if (onSearchSelect) {
      onSearchSelect(item)
    } else if (item.page && onNavigate) {
      onNavigate(item.page, item.intent)
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

  const pushDevToast = (tone: QuickNoticeTone, message: string) => {
    setDevToast({ tone, message, nonce: Date.now() })
  }

  const handleLogSnapshot = () => {
    console.info('[DevTools] ERP snapshot', data)
    pushDevToast('info', 'Estado logado no console.')
  }

  const handleCopySnapshot = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      pushDevToast('warning', 'Clipboard indisponível.')
      return
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      pushDevToast('success', 'Estado copiado para a área de transferência.')
    } catch {
      pushDevToast('danger', 'Falha ao copiar o estado.')
    }
  }

  const renderSearchResults = (variant: 'dropdown' | 'overlay') => {
    if (!normalizedQuery) {
      return null
    }
    const items = variant === 'overlay' ? overlayResults : searchResults
    const hasResults = searchResultsCount > 0
    const hasMore = variant === 'overlay' && searchResultsCount > items.length
    return (
      <div
        className={`topbar__search-results ${
          variant === 'overlay' ? 'topbar__search-results--overlay' : ''
        }`}
        onMouseDown={(event) => event.preventDefault()}
      >
        {hasResults && (
          <div className="topbar__search-results-header">
            <span>Resultados</span>
            <span className="topbar__search-results-count">{searchResultsCount}</span>
          </div>
        )}
        {!hasResults ? (
          <div className="topbar__search-empty">Nenhum resultado encontrado.</div>
        ) : (
          <>
            {items.map((item) => (
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
            ))}
            {hasMore && (
              <div className="topbar__search-empty">
                Mostrando {items.length} de {searchResultsCount}. Refine sua busca.
              </div>
            )}
          </>
        )}
      </div>
    )
  }
  return (
    <>
      {showDevTools && devToast && (
        <QuickNotice
          message={<span key={devToast.nonce}>{devToast.message}</span>}
          tone={devToast.tone}
          onClear={() => setDevToast(null)}
          slot={2}
        />
      )}
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
        {brand && <div className="topbar__brand">{brand}</div>}
        <button
          className="topbar__search-toggle"
          type="button"
          onClick={() => {
            setIsSearchOpen(true)
            setIsNotificationsOpen(false)
            setIsDevToolsOpen(false)
          }}
          aria-label="Pesquisar"
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
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onKeyDown={handleSearchKeyDown}
          />
          {hasQuery && (
            <button
              className="topbar__icon topbar__search-clear"
              type="button"
              aria-label="Limpar busca"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery('')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          )}
          {isSearchFocused && renderSearchResults('dropdown')}
        </div>
      </div>
      <div className="topbar__right">
          {readOnly && <span className="topbar__badge">Somente leitura</span>}
          {showDevTools && (
            <div className="topbar__devtools">
              <button
                className="topbar__icon"
                type="button"
                aria-label="Ferramentas de dev"
                onClick={() => {
                  setIsDevToolsOpen((prev) => !prev)
                  setIsNotificationsOpen(false)
                  setIsSearchOpen(false)
                }}
                ref={devToolsButtonRef}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  bug_report
                </span>
              </button>
            </div>
          )}
          {showSensitiveToggle && (
            <button
              className="topbar__icon"
              type="button"
              onClick={onSensitiveToggle}
              aria-label={isSensitiveHidden ? 'Mostrar informações' : 'Ocultar informações'}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {isSensitiveHidden ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          )}
          {showNotifications && (
            <div className="topbar__notifications">
              <button
                className="topbar__icon"
                type="button"
                aria-label={
                  notifications.length > 0
                    ? `Notificações (${notifications.length})`
                    : 'Notificações'
                }
                onClick={() => {
                  setIsNotificationsOpen((prev) => !prev)
                  setIsSearchOpen(false)
                  setIsDevToolsOpen(false)
                }}
                ref={notificationsButtonRef}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {notificationIcon}
                </span>
              </button>
            </div>
          )}
          {showNotifications && isNotificationsOpen && (
            <div
              className="topbar__notifications-overlay"
              role="dialog"
              aria-modal="true"
              onClick={() => setIsNotificationsOpen(false)}
            >
              <div
                className="topbar__notifications-panel topbar__mini-modal"
                ref={notificationsRef}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="topbar__notifications-header">
                  <strong>Notificações</strong>
                  <button
                    className="topbar__notifications-close topbar__icon"
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    aria-label="Fechar notificações"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>
                <div className="topbar__notifications-list">
                  {notifications.length === 0 && (
                    <div className="topbar__notification-empty">
                      Sem notificações no momento.
                    </div>
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
            </div>
          )}
          {showDevTools && isDevToolsOpen && (
            <div
              className="topbar__notifications-overlay topbar__devtools-overlay"
              role="dialog"
              aria-modal="true"
              onClick={() => setIsDevToolsOpen(false)}
            >
              <div
                className="topbar__devtools-panel topbar__mini-modal"
                ref={devToolsRef}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="topbar__devtools-header">
                  <strong>Dev tools</strong>
                  <button
                    className="topbar__devtools-close topbar__icon"
                    type="button"
                    onClick={() => setIsDevToolsOpen(false)}
                    aria-label="Fechar dev tools"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>
                <div className="topbar__devtools-section">
                  <span className="topbar__devtools-title">Notificações rápidas</span>
                  <div className="topbar__devtools-actions">
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={() =>
                        pushDevToast('info', 'Notificação de teste (info).')
                      }
                    >
                      Info
                    </button>
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={() =>
                        pushDevToast('success', 'Notificação de teste (sucesso).')
                      }
                    >
                      Sucesso
                    </button>
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={() =>
                        pushDevToast('warning', 'Notificação de teste (alerta).')
                      }
                    >
                      Alerta
                    </button>
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={() =>
                        pushDevToast('danger', 'Notificação de teste (erro).')
                      }
                    >
                      Erro
                    </button>
                  </div>
                </div>
                <div className="topbar__devtools-section">
                  <span className="topbar__devtools-title">Debug rápido</span>
                  <div className="topbar__devtools-actions">
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={handleLogSnapshot}
                    >
                      Log do estado
                    </button>
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={handleCopySnapshot}
                    >
                      Copiar estado
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="topbar__profile">
            <button className="topbar__profile-main" type="button" onClick={onProfileOpen}>
              {userAvatarUrl ? (
                <img
                  className="topbar__avatar"
                  src={userAvatarUrl}
                  alt={userName ?? 'Usuario'}
                />
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
              <button className="topbar__icon" type="button" onClick={onLogout}>
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
          <div
            className="topbar__search-surface topbar__mini-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            {hasQuery && (
              <button
                className="topbar__icon topbar__search-clear"
                type="button"
                aria-label="Limpar busca"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setQuery('')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            )}
            <button
              className="topbar__icon topbar__search-close"
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
    </>
  )
}

export default Topbar
