import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
} from 'react'

type DimensionUnit = 'mm' | 'cm' | 'm'

type DimensionInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number
  onValueChange: (value: number) => void
  defaultUnit?: DimensionUnit
  unit?: DimensionUnit
  onUnitChange?: (unit: DimensionUnit) => void
  showPreview?: boolean
}

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  useGrouping: false,
})

const unitFactors: Record<DimensionUnit, number> = {
  mm: 1000,
  cm: 100,
  m: 1,
}

const formatMeasurement = (value: number) => numberFormatter.format(value)

const formatDisplayValue = (value: number, unit: DimensionUnit) => {
  if (!Number.isFinite(value)) {
    return ''
  }
  const normalized = value * unitFactors[unit]
  return Number.isFinite(normalized) ? formatMeasurement(normalized) : ''
}

const parseLocaleNumber = (raw: string, allowTrailingSeparator = false) => {
  let sanitized = raw.trim()
  if (!sanitized) {
    return undefined
  }
  if (allowTrailingSeparator && /[.,]$/.test(sanitized)) {
    sanitized = sanitized.slice(0, -1)
  }
  if (!sanitized || sanitized === '-' || sanitized === '+') {
    return undefined
  }
  if (!allowTrailingSeparator && /[.,]$/.test(sanitized)) {
    return undefined
  }
  sanitized = sanitized.replace(/\s/g, '')
  const hasComma = sanitized.includes(',')
  const hasDot = sanitized.includes('.')
  if (hasComma && hasDot) {
    if (sanitized.lastIndexOf(',') > sanitized.lastIndexOf('.')) {
      sanitized = sanitized.replace(/\./g, '').replace(',', '.')
    } else {
      sanitized = sanitized.replace(/,/g, '')
    }
  } else if (hasComma) {
    sanitized = sanitized.replace(/\./g, '').replace(',', '.')
  } else if (hasDot) {
    sanitized = sanitized.replace(/,/g, '')
  }
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : undefined
}

const toNumber = (value: string | number | undefined) => {
  if (value === undefined) {
    return undefined
  }
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : undefined
}

const DimensionInput = ({
  value,
  onValueChange,
  defaultUnit = 'cm',
  unit,
  onUnitChange,
  showPreview = true,
  className,
  min,
  max,
  step,
  disabled,
  ...props
}: DimensionInputProps) => {
  const { onBlur, onFocus, ...inputProps } = props
  const initialUnit = unit ?? defaultUnit
  const [localUnit, setLocalUnit] = useState<DimensionUnit>(defaultUnit)
  const [isFocused, setIsFocused] = useState(false)
  const activeUnit = unit ?? localUnit
  const handleUnitChange = onUnitChange ?? setLocalUnit
  const baseStep = toNumber(step) ?? 0.01
  const baseMin = toNumber(min)
  const baseMax = toNumber(max)

  const [inputValue, setInputValue] = useState(() =>
    formatDisplayValue(value, initialUnit),
  )

  useEffect(() => {
    if (isFocused) {
      return
    }
    setInputValue(formatDisplayValue(value, activeUnit))
  }, [activeUnit, isFocused, value])

  const displayStep = useMemo(() => {
    const converted = baseStep * unitFactors[activeUnit]
    return Number.isFinite(converted) ? converted : undefined
  }, [activeUnit, baseStep])

  const displayMin = useMemo(() => {
    if (baseMin === undefined) {
      return undefined
    }
    const converted = baseMin * unitFactors[activeUnit]
    return Number.isFinite(converted) ? converted : undefined
  }, [activeUnit, baseMin])

  const displayMax = useMemo(() => {
    if (baseMax === undefined) {
      return undefined
    }
    const converted = baseMax * unitFactors[activeUnit]
    return Number.isFinite(converted) ? converted : undefined
  }, [activeUnit, baseMax])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextInput = event.target.value
    setInputValue(nextInput)
    const raw = parseLocaleNumber(nextInput)
    if (raw === undefined) {
      return
    }
    const nextValue = raw / unitFactors[activeUnit]
    onValueChange(Number.isFinite(nextValue) ? nextValue : 0)
  }

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(event)
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(event)
    const raw = parseLocaleNumber(inputValue, true)
    const normalized = raw ?? 0
    const nextValue = normalized / unitFactors[activeUnit]
    onValueChange(Number.isFinite(nextValue) ? nextValue : 0)
    setInputValue(formatDisplayValue(Number.isFinite(nextValue) ? nextValue : 0, activeUnit))
  }

  const preview =
    showPreview && activeUnit !== 'm' && Number.isFinite(value) && value > 0
      ? `= ${formatMeasurement(value)} m`
      : null

  return (
    <div className="modal__input-unit">
      <div className="modal__input-row">
        <input
          {...inputProps}
          className={className}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          min={displayMin}
          max={displayMax}
          step={displayStep}
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
        />
        <select
          className="modal__input modal__unit-select"
          value={activeUnit}
          onChange={(event) => handleUnitChange(event.target.value as DimensionUnit)}
          disabled={disabled}
          aria-label="Unidade de medida"
        >
          <option value="mm">mm</option>
          <option value="cm">cm</option>
          <option value="m">m</option>
        </select>
      </div>
      {preview && <p className="modal__help">{preview}</p>}
    </div>
  )
}

export default DimensionInput
