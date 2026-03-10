import { useEffect, useState } from 'react'
import type { PtcState } from '../types/ptc'
import { ptcDataService } from '../services/ptcDataService'

export const usePtcData = () => {
  const [data, setData] = useState<PtcState>(() => ptcDataService.getAll())

  useEffect(() => {
    const handleSync = () => {
      setData(ptcDataService.getAll())
    }
    handleSync()
    if (typeof window !== 'undefined') {
      window.addEventListener('umoya:ptc', handleSync)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('umoya:ptc', handleSync)
      }
    }
  }, [])

  const refresh = () => {
    setData(ptcDataService.getAll())
  }

  return { data, refresh }
}
