import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import Login from '../pages/core/Login'
import ResetPassword from '../pages/core/ResetPassword'

const MIN_SCALE = 0.5
const MAX_SCALE = 2.6

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const readNumber = (value: string, fallback: number) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const resolveRecoveryMode = () => {
  if (typeof window === 'undefined') {
    return false
  }
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('type') === 'recovery'
}

const createDevUser = (id: string, name: string): User => ({
  id,
  email: 'dev@umoya.local',
  user_metadata: { name },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
})

const PasCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scaleRef = useRef(1)
  const rafRef = useRef<number | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const nextWidth = Math.round(rect.width * dpr)
    const nextHeight = Math.round(rect.height * dpr)
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth
      canvas.height = nextHeight
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const styles = getComputedStyle(canvas)
    const gridColor = styles.getPropertyValue('--pas-grid').trim() || '#531DFF'
    const dotColor = styles.getPropertyValue('--pas-dot').trim() || '#FFD300'
    const gridAlpha = readNumber(styles.getPropertyValue('--pas-grid-alpha'), 0.2)
    const dotAlpha = readNumber(styles.getPropertyValue('--pas-dot-alpha'), 0.38)
    const gridSize = readNumber(styles.getPropertyValue('--pas-grid-size'), 84)
    const dotSize = readNumber(styles.getPropertyValue('--pas-dot-size'), 1.6)

    ctx.save()
    ctx.translate(rect.width / 2, rect.height / 2)
    const scale = scaleRef.current
    ctx.scale(scale, scale)

    const worldWidth = rect.width / scale
    const worldHeight = rect.height / scale
    const startX = -worldWidth / 2
    const endX = worldWidth / 2
    const startY = -worldHeight / 2
    const endY = worldHeight / 2
    const firstX = Math.floor(startX / gridSize) * gridSize
    const firstY = Math.floor(startY / gridSize) * gridSize

    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1 / scale
    ctx.globalAlpha = gridAlpha

    ctx.beginPath()
    for (let x = firstX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
    }
    for (let y = firstY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
    }
    ctx.stroke()

    ctx.fillStyle = dotColor
    ctx.globalAlpha = dotAlpha
    const radius = dotSize / scale

    for (let x = firstX; x <= endX; x += gridSize) {
      for (let y = firstY; y <= endY; y += gridSize) {
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
    ctx.globalAlpha = 1
  }, [])

  const requestDraw = useCallback(() => {
    if (rafRef.current !== null) {
      return
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      draw()
    })
  }, [draw])

  useEffect(() => {
    requestDraw()
    const handleResize = () => requestDraw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [requestDraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const zoom = Math.exp(-event.deltaY * 0.001)
      const nextScale = clamp(scaleRef.current * zoom, MIN_SCALE, MAX_SCALE)
      if (nextScale === scaleRef.current) {
        return
      }
      scaleRef.current = nextScale
      requestDraw()
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [requestDraw])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return <canvas className="pas__canvas" ref={canvasRef} aria-label="PAS canvas" />
}

const PasApp = () => {
  const allowDevMode = import.meta.env && import.meta.env.DEV
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(resolveRecoveryMode)

  const startSession = (user: User) => {
    void user
    setIsAuthenticated(true)
  }

  const handleDevLogin = () => {
    const devUser = createDevUser('dev-pas', 'Dev PAS')
    startSession(devUser)
  }

  if (!isAuthenticated) {
    if (isRecoveryMode) {
      return <ResetPassword onDone={() => setIsRecoveryMode(false)} />
    }
    return (
      <Login
        onLogin={(user) => startSession(user)}
        onDevLogin={allowDevMode ? () => handleDevLogin() : undefined}
      />
    )
  }

  return (
    <div className="pas">
      <PasCanvas />
    </div>
  )
}

export default PasApp
