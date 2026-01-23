import { useEffect, useState } from 'react'
import type { ERPData } from '../types/erp'
import { dataService } from '../services/dataService'

export const useERPData = () => {
  const [data, setData] = useState<ERPData>(() => dataService.getAll())

  useEffect(() => {
    setData(dataService.getAll())
  }, [])

  const refresh = () => {
    setData(dataService.getAll())
  }

  return { data, refresh }
}
