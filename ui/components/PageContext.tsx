import { createContext, useContext, type ReactNode } from 'react'

type PageContextValue = {
  pageId?: string
}

const PageContext = createContext<PageContextValue>({})

type PageProviderProps = {
  pageId?: string
  children: ReactNode
}

export const PageProvider = ({ pageId, children }: PageProviderProps) => {
  return <PageContext.Provider value={{ pageId }}>{children}</PageContext.Provider>
}

export const usePageId = () => useContext(PageContext).pageId
