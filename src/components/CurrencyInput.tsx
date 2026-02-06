import { useMemo, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { formatCurrency } from '../utils/format'

type CurrencyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  allowEmpty?: boolean
}

const CurrencyInput = ({
  value,
  onValueChange,
  allowEmpty = false,
  ...props
}: CurrencyInputProps) => {
  const displayValue = useMemo(() => {
    if (allowEmpty && (value === null || value === undefined)) {
      return ''
    }
    return formatCurrency(value ?? 0)
  }, [allowEmpty, value])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '')
    if (allowEmpty && digits.length === 0) {
      onValueChange(null)
      return
    }
    const numeric = digits.length > 0 ? Number(digits) / 100 : 0
    onValueChange(Number.isFinite(numeric) ? numeric : 0)
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
    />
  )
}

export default CurrencyInput
