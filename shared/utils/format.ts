export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const formatDateShort = (value: string) => {
  if (!value) {
    return '-'
  }
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value))
}
