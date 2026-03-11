import { useCallback, useState } from 'react'

export interface CEPData {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
}

type ViaCEPResponse = CEPData & { erro?: boolean }

const sanitizeCep = (value: string) => value.replace(/\D/g, '')

export const useCEP = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscarCEP = useCallback(async (cep: string): Promise<CEPData | null> => {
    const sanitized = sanitizeCep(cep)
    if (sanitized.length !== 8) {
      setError('CEP invalido.')
      return null
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${sanitized}/json/`)
      if (!response.ok) {
        setError('Nao foi possivel consultar o CEP.')
        return null
      }

      const data = (await response.json()) as ViaCEPResponse
      if (data.erro) {
        setError('CEP nao encontrado.')
        return null
      }

      return {
        cep: data.cep ?? sanitized,
        logradouro: data.logradouro ?? '',
        complemento: data.complemento ?? '',
        bairro: data.bairro ?? '',
        localidade: data.localidade ?? '',
        uf: data.uf ?? '',
      }
    } catch {
      setError('Nao foi possivel consultar o CEP.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { buscarCEP, loading, error }
}
