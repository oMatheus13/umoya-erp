import { useEffect, useState } from 'react'
import type { ERPData } from '../types/erp'
import { dataService } from '../services/dataService'

export const useERPData = () => {
  const [data, setData] = useState<ERPData>(() => dataService.getAll())

  useEffect(() => {
    const handleSync = () => {
      setData(dataService.getAll())
    }
    handleSync()
    if (typeof window !== 'undefined') {
      window.addEventListener('umoya:data', handleSync)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('umoya:data', handleSync)
      }
    }
  }, [])

  const refresh = () => {
    setData(dataService.getAll())
  }

  return { data, refresh }
}
