import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export type QuickNoticeTone = 'info' | 'success' | 'warning' | 'danger'

type QuickNoticeProps = {
  message: ReactNode | null
  tone?: QuickNoticeTone
  autoHideMs?: number
  onClear?: () => void
  className?: string
  slot?: number
  interactive?: boolean
}

const DEFAULT_AUTO_HIDE_MS = 3500

const inferTone = (message: string): QuickNoticeTone => {
  const normalized = message.toLowerCase()
  const dangerHints = [
    'falha',
    'erro',
    'inval',
    'incorreto',
    'nao ',
    'não ',
    'sem ',
    'obrig',
    'precisa',
    'bloqueado',
    'expir',
    'negativo',
    'informe',
    'recus',
  ]
  const successHints = [
    'sucesso',
    'salvo',
    'atualiz',
    'cadastr',
    'registr',
    'conclu',
    'confirm',
    'enviado',
    'aprov',
    'finaliz',
    'criado',
    'liberado',
    'pago',
    'pronto',
  ]
  if (dangerHints.some((hint) => normalized.includes(hint))) {
    return 'danger'
  }
  if (successHints.some((hint) => normalized.includes(hint))) {
    return 'success'
  }
  return 'info'
}

const QuickNotice = ({
  message,
  tone,
  autoHideMs = DEFAULT_AUTO_HIDE_MS,
  onClear,
  className,
  slot = 0,
  interactive = false,
}: QuickNoticeProps) => {
  const [visibleMessage, setVisibleMessage] = useState<ReactNode | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!message) {
      setVisibleMessage(null)
      return
    }
    setVisibleMessage(message)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (autoHideMs > 0) {
      timerRef.current = setTimeout(() => {
        setVisibleMessage((current) => (current === message ? null : current))
        if (onClear) {
          onClear()
        }
        timerRef.current = null
      }, autoHideMs)
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [autoHideMs, message, onClear])

  if (!visibleMessage) {
    return null
  }

  const styles = slot
    ? ({ '--quick-notice-slot': slot } as CSSProperties)
    : undefined
  const resolvedTone =
    tone ?? (typeof visibleMessage === 'string' ? inferTone(visibleMessage) : 'info')

  return (
    <div
      className={[
        'quick-notice',
        `quick-notice--${resolvedTone}`,
        interactive ? 'quick-notice--interactive' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={styles}
      role="status"
      aria-live="polite"
    >
      {visibleMessage}
    </div>
  )
}

export default QuickNotice
