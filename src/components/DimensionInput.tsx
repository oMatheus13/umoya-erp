import { useMemo, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'

type DimensionUnit = 'cm' | 'm'

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

const formatMeasurement = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)

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
  const [localUnit, setLocalUnit] = useState<DimensionUnit>(defaultUnit)
  const activeUnit = unit ?? localUnit
  const handleUnitChange = onUnitChange ?? setLocalUnit
  const baseStep = toNumber(step) ?? 0.01
  const baseMin = toNumber(min)
  const baseMax = toNumber(max)

  const displayValue = useMemo(() => {
    if (!Number.isFinite(value)) {
      return ''
    }
    const normalized = activeUnit === 'cm' ? value * 100 : value
    const rounded = Math.round(normalized * 100) / 100
    return Number.isFinite(rounded) ? String(rounded) : ''
  }, [activeUnit, value])

  const displayStep = useMemo(() => {
    const converted = activeUnit === 'cm' ? baseStep * 100 : baseStep
    return Number.isFinite(converted) ? converted : undefined
  }, [activeUnit, baseStep])

  const displayMin = useMemo(() => {
    if (baseMin === undefined) {
      return undefined
    }
    const converted = activeUnit === 'cm' ? baseMin * 100 : baseMin
    return Number.isFinite(converted) ? converted : undefined
  }, [activeUnit, baseMin])

  const displayMax = useMemo(() => {
    if (baseMax === undefined) {
      return undefined
    }
    const converted = activeUnit === 'cm' ? baseMax * 100 : baseMax
    return Number.isFinite(converted) ? converted : undefined
  }, [activeUnit, baseMax])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = Number(event.target.value)
    const normalized = Number.isFinite(raw) ? raw : 0
    const nextValue = activeUnit === 'cm' ? normalized / 100 : normalized
    onValueChange(Number.isFinite(nextValue) ? nextValue : 0)
  }

  const preview =
    showPreview && activeUnit === 'cm' && Number.isFinite(value) && value > 0
      ? `= ${formatMeasurement(value)} m`
      : null

  return (
    <div className="modal__input-unit">
      <div className="modal__input-row">
        <input
          {...props}
          className={className}
          type="number"
          min={displayMin}
          max={displayMax}
          step={displayStep}
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
        />
        <select
          className="modal__input modal__unit-select"
          value={activeUnit}
          onChange={(event) => handleUnitChange(event.target.value as DimensionUnit)}
          disabled={disabled}
          aria-label="Unidade de medida"
        >
          <option value="cm">cm</option>
          <option value="m">m</option>
        </select>
      </div>
      {preview && <p className="modal__help">{preview}</p>}
    </div>
  )
}

export default DimensionInput
