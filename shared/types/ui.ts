export type SidebarMode = 'expanded' | 'collapsed' | 'hover'

export type PageIntentAction =
  | { type: 'new' }
  | { type: 'open-product'; productId: string }
  | { type: 'open-variant'; productId: string; variantId: string }

export type PageIntent = {
  page: string
  action: PageIntentAction
}
