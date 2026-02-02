export const BALDE_LITERS = 10
export const LITER_M3 = 0.001
export const BALDE_M3 = BALDE_LITERS * LITER_M3

export const CARRINHO_RENTE_BALDES = 5
export const CARRINHO_CHEIO_BALDES = 7

export const CIMENTO_SACO_BALDES = 3.5

export const toM3FromBaldes = (baldes: number) => baldes * BALDE_M3
export const toM3FromCarrinhoRente = (carrinhos: number) =>
  toM3FromBaldes(carrinhos * CARRINHO_RENTE_BALDES)
export const toM3FromCarrinhoCheio = (carrinhos: number) =>
  toM3FromBaldes(carrinhos * CARRINHO_CHEIO_BALDES)

export const toSacoFromBaldes = (baldes: number) => baldes / CIMENTO_SACO_BALDES
