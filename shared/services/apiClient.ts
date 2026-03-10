export type ApiConfig = {
  baseUrl: string
}

export const createApiClient = (config: ApiConfig) => {
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${config.baseUrl}${path}`, options)
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`)
    }
    return (await response.json()) as T
  }

  return { request }
}
