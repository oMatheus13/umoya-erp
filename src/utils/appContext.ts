export type AppKind = 'erp' | 'pdv' | 'pop' | 'ptc'

export const resolveAppKind = (): AppKind => {
  if (typeof window === 'undefined') {
    return 'erp'
  }
  const host = window.location.hostname.toLowerCase()
  const path = window.location.pathname || ''
  if (host.startsWith('pdv.') || path.startsWith('/pdv')) {
    return 'pdv'
  }
  if (host.startsWith('pop.') || path.startsWith('/pop') || path.startsWith('/apontamento')) {
    return 'pop'
  }
  if (host.startsWith('ptc.') || path.startsWith('/ptc')) {
    return 'ptc'
  }
  return 'erp'
}
