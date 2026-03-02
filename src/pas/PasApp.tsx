import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { User } from '@supabase/supabase-js'
import Topbar from '../components/Topbar'
import Login from '../pages/core/Login'
import ResetPassword from '../pages/core/ResetPassword'
import logotipo from '../assets/brand/logotipo.svg'
import { pasRemote } from '../services/pasRemote'
import { supabase } from '../services/supabaseClient'
import type {
  FlowArrowStyle,
  FlowAnchor,
  FlowConnector,
  FlowConnectorStyle,
  FlowElement,
  FlowElementPosition,
  FlowElementStyle,
  FlowElementType,
  FlowLineShape,
  FlowLineStyle,
  PasState,
} from '../types/pas'
import { createId } from '../utils/ids'

const DEFAULT_VIEWPORT = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
}

const DEFAULT_ELEMENT_STYLE: FlowElementStyle = {
  fill: '#141a23',
  stroke: '#5f6674',
  textColor: '#e8e9ef',
  strokeWidth: 2,
  fontSize: 16,
  fontFamily: 'var(--font-family-secondary)',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'center',
}

const DEFAULT_CONNECTOR_STYLE: FlowConnectorStyle = {
  stroke: '#9aa3b2',
  strokeWidth: 2,
  lineStyle: 'solid',
  lineShape: 'orthogonal',
  startArrow: 'none',
  endArrow: 'arrow',
  hasLineJump: false,
  labelPlacement: 'none',
}

const createEmptyState = (): PasState => ({
  viewport: { ...DEFAULT_VIEWPORT },
  elements: [],
  connectors: [],
  settings: {
    snapToGrid: true,
    gridSize: 32,
  },
})

type ToolKind = 'select' | 'hand' | 'text' | 'note' | 'shape' | 'connector' | 'arrow'

type ToolDefinition = {
  id: string
  label: string
  icon: string
  kind: ToolKind
  elementType?: FlowElementType
  description?: string
}

type DraftConnector = {
  start: FlowElementPosition
  end: FlowElementPosition
  fromId?: string
  fromAnchor?: FlowAnchor
  toId?: string
  toAnchor?: FlowAnchor
  label?: string
  style: FlowConnectorStyle
}

type DragState = {
  startX: number
  startY: number
  primaryId: string
  items: Array<{ id: string; startX: number; startY: number }>
  hasMoved: boolean
}

type SelectionBox = {
  start: FlowElementPosition
  end: FlowElementPosition
  additive: boolean
}

type ConnectorHandleDrag = {
  connectorId: string
  handle: 'start' | 'end'
}

const TOOL_SECTIONS: Array<{ id: string; label: string; tools: ToolDefinition[] }> = [
  {
    id: 'padrao',
    label: 'Padrao',
    tools: [
      { id: 'select', label: 'Selecao', icon: 'near_me', kind: 'select' },
      { id: 'text', label: 'Texto', icon: 'text_fields', kind: 'text', elementType: 'text' },
      { id: 'note', label: 'Bloco de notas', icon: 'sticky_note_2', kind: 'note', elementType: 'note' },
      { id: 'arrow', label: 'Seta', icon: 'trending_flat', kind: 'arrow' },
    ],
  },
  {
    id: 'fluxograma',
    label: 'Fluxograma',
    tools: [
      { id: 'terminator', label: 'Inicio/Fim', icon: 'radio_button_checked', kind: 'shape', elementType: 'terminator' },
      { id: 'process', label: 'Processo', icon: 'crop_16_9', kind: 'shape', elementType: 'process' },
      { id: 'decision', label: 'Decisao', icon: 'diamond', kind: 'shape', elementType: 'decision' },
      { id: 'data', label: 'Entrada/Saida', icon: 'input', kind: 'shape', elementType: 'data' },
      { id: 'document', label: 'Documento', icon: 'description', kind: 'shape', elementType: 'document' },
      { id: 'manual-input', label: 'Manual', icon: 'edit_note', kind: 'shape', elementType: 'manual-input' },
      { id: 'predefined-process', label: 'Subprocesso', icon: 'view_column', kind: 'shape', elementType: 'predefined-process' },
      { id: 'database', label: 'Base de dados', icon: 'storage', kind: 'shape', elementType: 'database' },
      { id: 'connector', label: 'Conector', icon: 'fiber_manual_record', kind: 'shape', elementType: 'connector' },
      { id: 'off-page', label: 'Off-page', icon: 'move_to_inbox', kind: 'shape', elementType: 'off-page' },
    ],
  },
  {
    id: 'formas',
    label: 'Formas',
    tools: [
      { id: 'rectangle', label: 'Retangulo', icon: 'crop_square', kind: 'shape', elementType: 'rectangle' },
      { id: 'rounded', label: 'Retangulo arredondado', icon: 'crop_square', kind: 'shape', elementType: 'rounded' },
      { id: 'ellipse', label: 'Elipse', icon: 'circle', kind: 'shape', elementType: 'ellipse' },
      { id: 'triangle', label: 'Triangulo', icon: 'change_history', kind: 'shape', elementType: 'triangle' },
      { id: 'diamond', label: 'Losango', icon: 'diamond', kind: 'shape', elementType: 'diamond' },
      { id: 'hexagon', label: 'Hexagono', icon: 'hexagon', kind: 'shape', elementType: 'hexagon' },
      { id: 'parallelogram', label: 'Paralelogramo', icon: 'crop_rotate', kind: 'shape', elementType: 'parallelogram' },
      { id: 'star', label: 'Estrela', icon: 'star', kind: 'shape', elementType: 'star' },
    ],
  },
]

const TOOL_MAP = new Map(TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => [tool.id, tool])))

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]
const LINE_WIDTHS = [1, 2, 3, 4, 6, 8]

const FONT_FAMILIES = [
  { id: 'primary', label: 'Clash Display', value: 'var(--font-family-primary)' },
  { id: 'secondary', label: 'Archivo', value: 'var(--font-family-secondary)' },
  {
    id: 'mono',
    label: 'Monospace',
    value:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
]

const LINE_STYLES: Array<{ id: FlowLineStyle; label: string }> = [
  { id: 'solid', label: 'Solida' },
  { id: 'dashed', label: 'Tracejada' },
  { id: 'dotted', label: 'Pontilhada' },
  { id: 'double', label: 'Dupla' },
]

const LINE_SHAPES: Array<{ id: FlowLineShape; label: string }> = [
  { id: 'straight', label: 'Reta' },
  { id: 'orthogonal', label: '90 graus' },
  { id: 'curved', label: 'Curva' },
  { id: 'elbow', label: 'Elbow' },
]

const ARROW_STYLES: Array<{ id: FlowArrowStyle; label: string }> = [
  { id: 'none', label: 'Nenhuma' },
  { id: 'arrow', label: 'Seta' },
  { id: 'triangle', label: 'Triangulo' },
  { id: 'circle', label: 'Circulo' },
  { id: 'diamond', label: 'Losango' },
  { id: 'bar', label: 'Barra' },
]

const LINE_LABEL_PLACEMENTS: Array<{ id: FlowConnectorStyle['labelPlacement']; label: string }> = [
  { id: 'none', label: 'Sem texto' },
  { id: 'center', label: 'Centro' },
  { id: 'source', label: 'Inicio' },
  { id: 'target', label: 'Fim' },
]

const ANCHOR_POINTS: FlowAnchor[] = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
]

const ANCHOR_OFFSET = 6
const DIAGONAL_UNIT = Math.SQRT1_2

const DEFAULT_SIZES: Record<FlowElementType, { width: number; height: number }> = {
  text: { width: 192, height: 64 },
  note: { width: 256, height: 160 },
  terminator: { width: 192, height: 64 },
  process: { width: 224, height: 96 },
  decision: { width: 192, height: 192 },
  data: { width: 224, height: 96 },
  document: { width: 224, height: 96 },
  'manual-input': { width: 224, height: 96 },
  'predefined-process': { width: 224, height: 96 },
  database: { width: 192, height: 128 },
  connector: { width: 96, height: 96 },
  'off-page': { width: 192, height: 96 },
  rectangle: { width: 224, height: 128 },
  rounded: { width: 224, height: 128 },
  ellipse: { width: 224, height: 128 },
  triangle: { width: 192, height: 160 },
  diamond: { width: 192, height: 192 },
  hexagon: { width: 224, height: 128 },
  parallelogram: { width: 224, height: 96 },
  star: { width: 192, height: 192 },
}

const DEFAULT_LABELS: Record<FlowElementType, string> = {
  text: 'Texto',
  note: 'Anotacao',
  terminator: 'Inicio/Fim',
  process: 'Processo',
  decision: 'Decisao',
  data: 'Entrada/Saida',
  document: 'Documento',
  'manual-input': 'Manual',
  'predefined-process': 'Subprocesso',
  database: 'Base de dados',
  connector: 'Conector',
  'off-page': 'Off-page',
  rectangle: 'Retangulo',
  rounded: 'Retangulo',
  ellipse: 'Elipse',
  triangle: 'Triangulo',
  diamond: 'Losango',
  hexagon: 'Hexagono',
  parallelogram: 'Paralelogramo',
  star: 'Estrela',
}

const normalizeState = (data: PasState | null | undefined): PasState => {
  const base = createEmptyState()
  if (!data || typeof data !== 'object') {
    return base
  }
  const elements = Array.isArray(data.elements)
    ? data.elements.flatMap((item) => {
        if (!item || typeof item !== 'object') {
          return []
        }
        const element = item as Partial<FlowElement>
        if (!element.id || !element.type) {
          return []
        }
        const type = element.type as FlowElementType
        const fallbackSize = DEFAULT_SIZES[type] ?? { width: 200, height: 120 }
        const size = element.size ?? fallbackSize
        const position = element.position ?? { x: 0, y: 0 }
        return [
          {
            id: String(element.id),
            type,
            label:
              typeof element.label === 'string'
                ? element.label
                : DEFAULT_LABELS[type] ?? 'Elemento',
            position: {
              x: Number(position.x ?? 0),
              y: Number(position.y ?? 0),
            },
            size: {
              width: Number(size.width ?? fallbackSize.width),
              height: Number(size.height ?? fallbackSize.height),
            },
            style: {
              ...DEFAULT_ELEMENT_STYLE,
              ...(element.style ?? {}),
            },
          },
        ]
      })
    : []
  const connectors = Array.isArray(data.connectors)
    ? data.connectors.flatMap((item) => {
        if (!item || typeof item !== 'object') {
          return []
        }
        const connector = item as Partial<FlowConnector>
        if (!connector.id) {
          return []
        }
        const rawPoints = Array.isArray(connector.points) ? connector.points : []
        const points = rawPoints
          .filter((point) => point && typeof point === 'object')
          .map((point) => {
            const coords = point as FlowElementPosition
            return {
              x: Number(coords.x ?? 0),
              y: Number(coords.y ?? 0),
            }
          })
        if (points.length < 2) {
          return []
        }
        return [
          {
            id: String(connector.id),
            fromId: connector.fromId,
            fromAnchor: connector.fromAnchor,
            toId: connector.toId,
            toAnchor: connector.toAnchor,
            label: typeof connector.label === 'string' ? connector.label : undefined,
            points,
            style: {
              ...DEFAULT_CONNECTOR_STYLE,
              ...(connector.style ?? {}),
            },
          },
        ]
      })
    : []
  return {
    viewport: {
      ...base.viewport,
      ...(data.viewport ?? {}),
    },
    elements,
    connectors,
    settings: {
      ...base.settings,
      ...(data.settings ?? {}),
    },
  }
}

const resolveRecoveryMode = () => {
  if (typeof window === 'undefined') {
    return false
  }
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('type') === 'recovery'
}

const resolveSyncId = (user: User) =>
  (user.app_metadata?.workspace_id as string | undefined) ?? user.id

const resolveDisplayName = (user: User | null) => {
  if (!user) {
    return 'Usuario'
  }
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const displayName =
    (metadata?.displayName as string | undefined) ??
    (metadata?.display_name as string | undefined) ??
    (metadata?.name as string | undefined)
  return displayName?.trim() || user.email || 'Usuario'
}

const projectToEllipse = (
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  dx: number,
  dy: number,
): FlowElementPosition => {
  if (!dx && !dy) {
    return { x: centerX, y: centerY }
  }
  const scale =
    1 / Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY))
  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale,
  }
}

const projectToDiamond = (
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
  dx: number,
  dy: number,
): FlowElementPosition => {
  if (!dx && !dy) {
    return { x: centerX, y: centerY }
  }
  const scale = 1 / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight)
  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale,
  }
}

const projectToRoundedRect = (
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
  dx: number,
  dy: number,
): FlowElementPosition => {
  if (!dx && !dy) {
    return { x: centerX, y: centerY }
  }
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  const scaleX = absDx > 0 ? halfWidth / absDx : Number.POSITIVE_INFINITY
  const scaleY = absDy > 0 ? halfHeight / absDy : Number.POSITIVE_INFINITY
  const scale = Math.min(scaleX, scaleY)
  let x = centerX + dx * scale
  let y = centerY + dy * scale
  if (radius > 0) {
    const cornerX = centerX + Math.sign(dx) * (halfWidth - radius)
    const cornerY = centerY + Math.sign(dy) * (halfHeight - radius)
    const inCornerX = Math.abs(x - centerX) > halfWidth - radius
    const inCornerY = Math.abs(y - centerY) > halfHeight - radius
    if (inCornerX && inCornerY) {
      const vx = x - cornerX
      const vy = y - cornerY
      const len = Math.hypot(vx, vy) || 1
      x = cornerX + (vx / len) * radius
      y = cornerY + (vy / len) * radius
    }
  }
  return { x, y }
}

const getAnchorBasePosition = (element: FlowElement, anchor: FlowAnchor): FlowElementPosition => {
  const left = element.position.x
  const right = element.position.x + element.size.width
  const top = element.position.y
  const bottom = element.position.y + element.size.height
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const halfWidth = element.size.width / 2
  const halfHeight = element.size.height / 2

  let base: FlowElementPosition
  switch (anchor) {
    case 'top':
      base = { x: centerX, y: top }
      break
    case 'right':
      base = { x: right, y: centerY }
      break
    case 'bottom':
      base = { x: centerX, y: bottom }
      break
    case 'left':
      base = { x: left, y: centerY }
      break
    case 'top-left':
      base = { x: left, y: top }
      break
    case 'top-right':
      base = { x: right, y: top }
      break
    case 'bottom-right':
      base = { x: right, y: bottom }
      break
    case 'bottom-left':
      base = { x: left, y: bottom }
      break
    default:
      base = { x: centerX, y: centerY }
      break
  }

  const dx = base.x - centerX
  const dy = base.y - centerY
  if (element.type === 'ellipse' || element.type === 'connector') {
    return projectToEllipse(centerX, centerY, halfWidth, halfHeight, dx, dy)
  }
  if (element.type === 'decision' || element.type === 'diamond') {
    return projectToDiamond(centerX, centerY, halfWidth, halfHeight, dx, dy)
  }
  if (element.type === 'rounded' || element.type === 'terminator') {
    const radius =
      element.type === 'terminator'
        ? Math.min(halfWidth, halfHeight)
        : Math.min(18, halfWidth, halfHeight)
    return projectToRoundedRect(centerX, centerY, halfWidth, halfHeight, radius, dx, dy)
  }
  return base
}

const getAnchorNormal = (anchor: FlowAnchor): FlowElementPosition => {
  switch (anchor) {
    case 'top':
      return { x: 0, y: -1 }
    case 'right':
      return { x: 1, y: 0 }
    case 'bottom':
      return { x: 0, y: 1 }
    case 'left':
      return { x: -1, y: 0 }
    case 'top-left':
      return { x: -DIAGONAL_UNIT, y: -DIAGONAL_UNIT }
    case 'top-right':
      return { x: DIAGONAL_UNIT, y: -DIAGONAL_UNIT }
    case 'bottom-right':
      return { x: DIAGONAL_UNIT, y: DIAGONAL_UNIT }
    case 'bottom-left':
      return { x: -DIAGONAL_UNIT, y: DIAGONAL_UNIT }
    default:
      return { x: 0, y: 0 }
  }
}

const getAnchorPosition = (
  element: FlowElement,
  anchor: FlowAnchor,
  offset = 0,
): FlowElementPosition => {
  const base = getAnchorBasePosition(element, anchor)
  if (!offset) {
    return base
  }
  const normal = getAnchorNormal(anchor)
  return {
    x: base.x + normal.x * offset,
    y: base.y + normal.y * offset,
  }
}

const findClosestAnchor = (element: FlowElement, position: FlowElementPosition): FlowAnchor => {
  let closest = ANCHOR_POINTS[0]
  let closestDistance = Number.POSITIVE_INFINITY
  ANCHOR_POINTS.forEach((anchor) => {
    const point = getAnchorBasePosition(element, anchor)
    const distance = Math.hypot(position.x - point.x, position.y - point.y)
    if (distance < closestDistance) {
      closestDistance = distance
      closest = anchor
    }
  })
  return closest
}

const syncConnectorEndpoints = (
  connectors: FlowConnector[],
  elements: FlowElement[],
): FlowConnector[] =>
  connectors.map((connector) => {
    if (!connector.points || connector.points.length < 2) {
      return connector
    }
    let updated = false
    const nextPoints = [...connector.points]
    let nextFromAnchor = connector.fromAnchor
    let nextToAnchor = connector.toAnchor
    if (connector.fromId) {
      const origin = elements.find((element) => element.id === connector.fromId)
      if (origin) {
        const anchor =
          connector.fromAnchor ??
          findClosestAnchor(origin, nextPoints[nextPoints.length - 1] ?? nextPoints[0])
        nextFromAnchor = anchor
        const offset = ANCHOR_OFFSET + origin.style.strokeWidth
        nextPoints[0] = getAnchorPosition(origin, anchor, offset)
        updated = true
      }
    }
    if (connector.toId) {
      const target = elements.find((element) => element.id === connector.toId)
      if (target) {
        const anchor =
          connector.toAnchor ??
          findClosestAnchor(target, nextPoints[0] ?? nextPoints[nextPoints.length - 1])
        nextToAnchor = anchor
        const offset = ANCHOR_OFFSET + target.style.strokeWidth
        nextPoints[nextPoints.length - 1] = getAnchorPosition(target, anchor, offset)
        updated = true
      }
    }
    if (!updated) {
      return connector
    }
    return {
      ...connector,
      points: nextPoints,
      fromAnchor: nextFromAnchor,
      toAnchor: nextToAnchor,
    }
  })

const resolveConnectorPath = (
  start: FlowElementPosition,
  end: FlowElementPosition,
  shape: FlowLineShape,
) => {
  if (shape === 'straight') {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  }
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (shape === 'curved') {
    const control1 = { x: start.x + dx * 0.25, y: start.y }
    const control2 = { x: start.x + dx * 0.75, y: end.y }
    return `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`
  }
  if (shape === 'elbow') {
    if (Math.abs(dx) > Math.abs(dy)) {
      return `M ${start.x} ${start.y} L ${end.x} ${start.y} L ${end.x} ${end.y}`
    }
    return `M ${start.x} ${start.y} L ${start.x} ${end.y} L ${end.x} ${end.y}`
  }
  const midX = start.x + dx / 2
  return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`
}

const resolveLabelPosition = (
  start: FlowElementPosition,
  end: FlowElementPosition,
  placement: FlowConnectorStyle['labelPlacement'],
) => {
  let t = 0.5
  if (placement === 'source') {
    t = 0.25
  }
  if (placement === 'target') {
    t = 0.75
  }
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  }
}

const resolveDashArray = (style: FlowLineStyle, strokeWidth: number) => {
  if (style === 'dashed') {
    return `${strokeWidth * 4} ${strokeWidth * 2}`
  }
  if (style === 'dotted') {
    return `${strokeWidth} ${strokeWidth * 1.5}`
  }
  return undefined
}

const resolveJumpSegment = (start: FlowElementPosition, end: FlowElementPosition) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) {
    return null
  }
  const unitX = dx / distance
  const unitY = dy / distance
  const half = Math.min(14, distance / 4)
  const midX = start.x + dx / 2
  const midY = start.y + dy / 2
  return {
    start: { x: midX - unitX * half, y: midY - unitY * half },
    end: { x: midX + unitX * half, y: midY + unitY * half },
  }
}

const resolveMarkerId = (arrow: FlowArrowStyle) =>
  arrow === 'none' ? undefined : `url(#pas-marker-${arrow})`

const createRemoteSync = (syncId: string) => {
  const SYNC_DEBOUNCE_MS = 400
  let pending: PasState | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async () => {
    if (!pending) {
      return
    }
    const payload = pending
    pending = null
    const result = await pasRemote.upsertState(syncId, payload)
    void result
  }

  return (data: PasState) => {
    pending = data
    if (timer) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, SYNC_DEBOUNCE_MS)
  }
}

const createDevUser = (id: string, name: string): User => ({
  id,
  email: 'dev@umoya.local',
  user_metadata: { name },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
})

const PasApp = () => {
  const allowDevMode = import.meta.env && import.meta.env.DEV
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(resolveRecoveryMode)
  const [state, setState] = useState<PasState>(() => createEmptyState())
  const stateRef = useRef(state)
  const [historyIndex, setHistoryIndex] = useState(0)
  const historyRef = useRef<PasState[]>([state])
  const historyIndexRef = useRef(0)
  const [activeTool, setActiveTool] = useState('select')
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null)
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [lineStyle, setLineStyle] = useState<FlowConnectorStyle>(DEFAULT_CONNECTOR_STYLE)
  const [lineLabel, setLineLabel] = useState('Texto')
  const [elementStyle, setElementStyle] = useState<FlowElementStyle>(DEFAULT_ELEMENT_STYLE)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isTopVisible, setIsTopVisible] = useState(true)
  const [isLeftVisible, setIsLeftVisible] = useState(true)
  const [isRightVisible, setIsRightVisible] = useState(true)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)
  const [isBottomVisible, setIsBottomVisible] = useState(true)
  const [openToolbarPanel, setOpenToolbarPanel] = useState<
    'text' | 'colors' | 'line' | 'actions' | null
  >(null)
  const restoreLayoutRef = useRef({
    top: true,
    left: true,
    right: true,
    rightCollapsed: false,
    bottom: true,
  })
  const syncHandlerRef = useRef<((data: PasState) => void) | null>(null)
  const isHydratingRef = useRef(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)
  const connectorDraftRef = useRef<DraftConnector | null>(null)
  const [draftConnector, setDraftConnector] = useState<DraftConnector | null>(null)
  const connectorHandleRef = useRef<ConnectorHandleDrag | null>(null)
  const selectionRef = useRef<SelectionBox | null>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const initHistory = (next: PasState) => {
    historyRef.current = [next]
    historyIndexRef.current = 0
    setHistoryIndex(0)
  }

  const pushHistory = (next: PasState) => {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1)
    trimmed.push(next)
    historyRef.current = trimmed
    historyIndexRef.current = trimmed.length - 1
    setHistoryIndex(historyIndexRef.current)
  }

  const commitState = useCallback(
    (
      updater: (prev: PasState) => PasState,
      options?: { skipHistory?: boolean; skipSync?: boolean },
    ) => {
      setState((prev) => {
        const next = updater(prev)
        stateRef.current = next
        if (!options?.skipHistory) {
          pushHistory(next)
        }
        if (!options?.skipSync && !isHydratingRef.current) {
          syncHandlerRef.current?.(next)
        }
        return next
      })
    },
    [],
  )

  const loadState = async (user: User) => {
    const resolvedSyncId = resolveSyncId(user)
    const remote = await pasRemote.fetchState(resolvedSyncId)
    const next = normalizeState(remote.data)
    const hydrated = {
      ...next,
      connectors: syncConnectorEndpoints(next.connectors, next.elements),
    }
    isHydratingRef.current = true
    setState(hydrated)
    initHistory(hydrated)
    isHydratingRef.current = false
    const handler = createRemoteSync(resolvedSyncId)
    syncHandlerRef.current = handler
  }

  const startSession = async (user: User) => {
    setCurrentUser(user)
    setIsAuthenticated(true)
    await loadState(user)
  }

  const handleDevLogin = () => {
    const devUser = createDevUser('dev-pas', 'Dev PAS')
    void startSession(devUser)
  }

  const handleLogout = async () => {
    syncHandlerRef.current = null
    setCurrentUser(null)
    setIsAuthenticated(false)
    if (supabase) {
      await supabase.auth.signOut()
    }
  }

  const primarySelectedElementId =
    selectedElementIds.length > 0 ? selectedElementIds[selectedElementIds.length - 1] : null
  const selectedElementCount = selectedElementIds.length

  const selectedElement = useMemo(
    () => state.elements.find((item) => item.id === primarySelectedElementId) ?? null,
    [primarySelectedElementId, state.elements],
  )
  const selectedConnector = useMemo(
    () => state.connectors.find((item) => item.id === selectedConnectorId) ?? null,
    [selectedConnectorId, state.connectors],
  )

  useEffect(() => {
    if (selectedElement) {
      setElementStyle(selectedElement.style)
    }
  }, [selectedElement])

  useEffect(() => {
    if (selectedConnector) {
      setLineStyle(selectedConnector.style)
      setLineLabel(selectedConnector.label ?? '')
    }
  }, [selectedConnector])

  const canvasZoom = state.viewport.zoom
  const gridSize = state.settings.gridSize
  const gridSizePx = Math.max(8, Math.round(gridSize * canvasZoom))

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyRef.current.length - 1

  const handleUndo = () => {
    if (!canUndo) {
      return
    }
    const nextIndex = historyIndexRef.current - 1
    const next = historyRef.current[nextIndex]
    historyIndexRef.current = nextIndex
    setHistoryIndex(nextIndex)
    setState(next)
    syncHandlerRef.current?.(next)
  }

  const handleRedo = () => {
    if (!canRedo) {
      return
    }
    const nextIndex = historyIndexRef.current + 1
    const next = historyRef.current[nextIndex]
    historyIndexRef.current = nextIndex
    setHistoryIndex(nextIndex)
    setState(next)
    syncHandlerRef.current?.(next)
  }

  const updateElementStyle = (patch: Partial<FlowElementStyle>) => {
    setElementStyle((prev) => ({ ...prev, ...patch }))
    if (selectedElementIds.length === 0) {
      return
    }
    const selectedIds = new Set(selectedElementIds)
    commitState((prev) => {
      const nextElements = prev.elements.map((item) =>
        selectedIds.has(item.id) ? { ...item, style: { ...item.style, ...patch } } : item,
      )
      return {
        ...prev,
        elements: nextElements,
        connectors: syncConnectorEndpoints(prev.connectors, nextElements),
      }
    })
  }

  const updateSelectedElement = (patch: Partial<FlowElement>) => {
    if (!primarySelectedElementId) {
      return
    }
    commitState((prev) => {
      const nextElements = prev.elements.map((item) =>
        item.id === primarySelectedElementId ? { ...item, ...patch } : item,
      )
      return {
        ...prev,
        elements: nextElements,
        connectors: syncConnectorEndpoints(prev.connectors, nextElements),
      }
    })
  }

  const updateElementLabel = (id: string, label: string) => {
    commitState((prev) => {
      const nextElements = prev.elements.map((item) =>
        item.id === id ? { ...item, label } : item,
      )
      return {
        ...prev,
        elements: nextElements,
        connectors: syncConnectorEndpoints(prev.connectors, nextElements),
      }
    })
  }

  const startEditingElement = (element: FlowElement) => {
    setSelectedElementIds([element.id])
    setSelectedConnectorId(null)
    setEditingElementId(element.id)
    setEditingValue(element.label)
  }

  const finishEditingElement = (shouldCommit: boolean) => {
    if (!editingElementId) {
      return
    }
    if (shouldCommit) {
      updateElementLabel(editingElementId, editingValue)
    }
    setEditingElementId(null)
  }

  const updateConnectorStyle = (patch: Partial<FlowConnectorStyle>) => {
    setLineStyle((prev) => ({ ...prev, ...patch }))
    if (!selectedConnectorId) {
      return
    }
    commitState((prev) => ({
      ...prev,
      connectors: prev.connectors.map((item) =>
        item.id === selectedConnectorId
          ? { ...item, style: { ...item.style, ...patch } }
          : item,
      ),
    }))
  }

  const updateConnectorLabel = (label: string) => {
    setLineLabel(label)
    if (!selectedConnectorId) {
      return
    }
    commitState((prev) => ({
      ...prev,
      connectors: prev.connectors.map((item) =>
        item.id === selectedConnectorId ? { ...item, label } : item,
      ),
    }))
  }

  const updateSelectedConnector = (patch: Partial<FlowConnector>) => {
    if (!selectedConnectorId) {
      return
    }
    commitState((prev) => ({
      ...prev,
      connectors: prev.connectors.map((item) =>
        item.id === selectedConnectorId ? { ...item, ...patch } : item,
      ),
    }))
  }

  const toWorldPosition = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) {
        return { x: clientX, y: clientY }
      }
      return {
        x: (clientX - rect.left - state.viewport.offsetX) / state.viewport.zoom,
        y: (clientY - rect.top - state.viewport.offsetY) / state.viewport.zoom,
      }
    },
    [state.viewport.offsetX, state.viewport.offsetY, state.viewport.zoom],
  )

  const applySnap = useCallback(
    (value: number) =>
      state.settings.snapToGrid ? Math.round(value / gridSize) * gridSize : value,
    [gridSize, state.settings.snapToGrid],
  )

  const toggleToolbarPanel = (panel: 'text' | 'colors' | 'line' | 'actions') => {
    setOpenToolbarPanel((prev) => (prev === panel ? null : panel))
  }

  const handleRightCollapse = () => {
    setIsRightCollapsed((prev) => !prev)
  }

  const handleRightClose = () => {
    setIsRightVisible(false)
    setIsRightCollapsed(false)
  }

  const createElementAtPosition = useCallback(
    (toolId: string, position: FlowElementPosition) => {
      const tool = TOOL_MAP.get(toolId)
      if (!tool?.elementType) {
        return
      }
      const size = DEFAULT_SIZES[tool.elementType]
      const next: FlowElement = {
        id: createId(),
        type: tool.elementType,
        label: DEFAULT_LABELS[tool.elementType],
        position: {
          x: applySnap(position.x - size.width / 2),
          y: applySnap(position.y - size.height / 2),
        },
        size,
        style: { ...elementStyle },
      }
      commitState((prev) => ({ ...prev, elements: [...prev.elements, next] }))
      setSelectedElementIds([next.id])
      setSelectedConnectorId(null)
    },
    [applySnap, commitState, elementStyle],
  )

  const handleToolDragStart = (event: ReactDragEvent<HTMLButtonElement>, toolId: string) => {
    event.dataTransfer.setData('text/plain', toolId)
    event.dataTransfer.effectAllowed = 'copy'
  }

  const handleCanvasDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const handleCanvasDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (openToolbarPanel) {
      setOpenToolbarPanel(null)
    }
    const toolId = event.dataTransfer.getData('text/plain')
    if (!toolId) {
      return
    }
    const position = toWorldPosition(event.clientX, event.clientY)
    createElementAtPosition(toolId, position)
  }

  const handleCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    const current = stateRef.current.viewport
    const delta = -event.deltaY * 0.0015
    const nextZoom = Math.min(3, Math.max(0.35, current.zoom + delta))
    if (nextZoom === current.zoom) {
      return
    }
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const worldX = (pointerX - current.offsetX) / current.zoom
    const worldY = (pointerY - current.offsetY) / current.zoom
    const nextOffsetX = pointerX - worldX * nextZoom
    const nextOffsetY = pointerY - worldY * nextZoom
    commitState(
      (prev) => ({
        ...prev,
        viewport: {
          ...prev.viewport,
          zoom: nextZoom,
          offsetX: nextOffsetX,
          offsetY: nextOffsetY,
        },
      }),
      { skipHistory: true },
    )
  }

  const findElementAtPosition = useCallback((position: FlowElementPosition) => {
    const elements = stateRef.current.elements
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index]
      const withinX =
        position.x >= element.position.x && position.x <= element.position.x + element.size.width
      const withinY =
        position.y >= element.position.y && position.y <= element.position.y + element.size.height
      if (withinX && withinY) {
        return element
      }
    }
    return null
  }, [])

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (openToolbarPanel) {
      setOpenToolbarPanel(null)
    }
    if (editingElementId) {
      finishEditingElement(true)
    }
    if (event.button !== 0 && event.button !== 1) {
      return
    }
    if (event.button === 1) {
      event.preventDefault()
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        offsetX: state.viewport.offsetX,
        offsetY: state.viewport.offsetY,
      }
      setSelectedElementIds([])
      setSelectedConnectorId(null)
      return
    }
    if (activeTool === 'hand') {
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        offsetX: state.viewport.offsetX,
        offsetY: state.viewport.offsetY,
      }
      setSelectedElementIds([])
      setSelectedConnectorId(null)
      return
    }
    if (activeTool === 'select') {
      const position = toWorldPosition(event.clientX, event.clientY)
      const additive = event.shiftKey || event.metaKey || event.ctrlKey
      selectionRef.current = {
        start: position,
        end: position,
        additive,
      }
      setSelectionBox(selectionRef.current)
      setSelectedConnectorId(null)
      if (!additive) {
        setSelectedElementIds([])
      }
      return
    }
    if (activeTool === 'arrow') {
      const position = toWorldPosition(event.clientX, event.clientY)
      const snapped = { x: applySnap(position.x), y: applySnap(position.y) }
      const draft: DraftConnector = {
        start: snapped,
        end: snapped,
        style: { ...lineStyle },
        label: lineLabel.trim() || undefined,
      }
      connectorDraftRef.current = draft
      setDraftConnector(draft)
      setSelectedElementIds([])
      setSelectedConnectorId(null)
      return
    }
    const position = toWorldPosition(event.clientX, event.clientY)
    createElementAtPosition(activeTool, position)
  }

  const handleElementPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    element: FlowElement,
  ) => {
    if (event.button !== 0) {
      return
    }
    if (editingElementId === element.id) {
      return
    }
    if (openToolbarPanel) {
      setOpenToolbarPanel(null)
    }
    event.stopPropagation()
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    if (additive) {
      setSelectedConnectorId(null)
      setSelectedElementIds((prev) =>
        prev.includes(element.id)
          ? prev.filter((id) => id !== element.id)
          : [...prev, element.id],
      )
      return
    }
    const position = toWorldPosition(event.clientX, event.clientY)
    const nextSelectedIds = selectedElementIds.includes(element.id)
      ? [...selectedElementIds.filter((id) => id !== element.id), element.id]
      : [element.id]
    const elementsById = new Map(stateRef.current.elements.map((item) => [item.id, item]))
    const items = nextSelectedIds
      .map((id) => elementsById.get(id))
      .filter((item): item is FlowElement => !!item)
      .map((item) => ({ id: item.id, startX: item.position.x, startY: item.position.y }))
    dragRef.current = {
      startX: position.x,
      startY: position.y,
      primaryId: element.id,
      items,
      hasMoved: false,
    }
    setSelectedElementIds(nextSelectedIds)
    setSelectedConnectorId(null)
  }

  const handleAnchorPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    element: FlowElement,
    anchor: FlowAnchor,
  ) => {
    event.stopPropagation()
    if (event.button !== 0) {
      return
    }
    if (activeTool !== 'arrow') {
      setActiveTool('arrow')
    }
    const anchorPosition = getAnchorPosition(
      element,
      anchor,
      ANCHOR_OFFSET + element.style.strokeWidth,
    )
    const snapped = { x: anchorPosition.x, y: anchorPosition.y }
    const draft: DraftConnector = {
      start: snapped,
      end: snapped,
      fromId: element.id,
      fromAnchor: anchor,
      style: { ...lineStyle },
      label: lineLabel.trim() || undefined,
    }
    connectorDraftRef.current = draft
    setDraftConnector(draft)
    setSelectedElementIds([])
    setSelectedConnectorId(null)
  }

  const handleConnectorPointerDown = (
    event: ReactPointerEvent<SVGPathElement>,
    connector: FlowConnector,
  ) => {
    if (event.button !== 0) {
      return
    }
    if (openToolbarPanel) {
      setOpenToolbarPanel(null)
    }
    event.stopPropagation()
    setSelectedConnectorId(connector.id)
    setSelectedElementIds([])
  }

  const handleConnectorHandlePointerDown = (
    event: ReactPointerEvent<SVGCircleElement>,
    connector: FlowConnector,
    handle: 'start' | 'end',
  ) => {
    event.stopPropagation()
    if (event.button !== 0) {
      return
    }
    if (openToolbarPanel) {
      setOpenToolbarPanel(null)
    }
    setSelectedConnectorId(connector.id)
    setSelectedElementIds([])
    connectorHandleRef.current = { connectorId: connector.id, handle }
  }

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (connectorDraftRef.current) {
        const position = toWorldPosition(event.clientX, event.clientY)
        const next = {
          ...connectorDraftRef.current,
          end: {
            x: applySnap(position.x),
            y: applySnap(position.y),
          },
        }
        connectorDraftRef.current = next
        setDraftConnector(next)
        return
      }
      if (connectorHandleRef.current) {
        const position = toWorldPosition(event.clientX, event.clientY)
        const snapped = { x: applySnap(position.x), y: applySnap(position.y) }
        const handle = connectorHandleRef.current
        commitState(
          (prev) => ({
            ...prev,
            connectors: prev.connectors.map((connector) => {
              if (connector.id !== handle.connectorId) {
                return connector
              }
              const points = connector.points ? [...connector.points] : [snapped, snapped]
              if (handle.handle === 'start') {
                points[0] = snapped
                return {
                  ...connector,
                  fromId: undefined,
                  fromAnchor: undefined,
                  points,
                }
              }
              points[points.length - 1] = snapped
              return {
                ...connector,
                toId: undefined,
                toAnchor: undefined,
                points,
              }
            }),
          }),
          { skipHistory: true, skipSync: true },
        )
        return
      }
      if (selectionRef.current) {
        const position = toWorldPosition(event.clientX, event.clientY)
        const next = {
          ...selectionRef.current,
          end: position,
        }
        selectionRef.current = next
        setSelectionBox(next)
        return
      }
      if (panRef.current) {
        const nextOffsetX = panRef.current.offsetX + (event.clientX - panRef.current.startX)
        const nextOffsetY = panRef.current.offsetY + (event.clientY - panRef.current.startY)
        commitState(
          (prev) => ({
            ...prev,
            viewport: {
              ...prev.viewport,
              offsetX: nextOffsetX,
              offsetY: nextOffsetY,
            },
          }),
          { skipHistory: true, skipSync: true },
        )
        return
      }
      if (!dragRef.current) {
        return
      }
      const position = toWorldPosition(event.clientX, event.clientY)
      const deltaX = position.x - dragRef.current.startX
      const deltaY = position.y - dragRef.current.startY
      const primary = dragRef.current.items.find((item) => item.id === dragRef.current?.primaryId)
      let offsetX = deltaX
      let offsetY = deltaY
      if (primary) {
        const snappedX = applySnap(primary.startX + deltaX)
        const snappedY = applySnap(primary.startY + deltaY)
        offsetX = snappedX - primary.startX
        offsetY = snappedY - primary.startY
      }
      dragRef.current.hasMoved = true
      const itemsMap = new Map(dragRef.current.items.map((item) => [item.id, item]))
      commitState(
        (prev) => {
          const nextElements = prev.elements.map((item) =>
            itemsMap.has(item.id)
              ? {
                  ...item,
                  position: {
                    x: (itemsMap.get(item.id)?.startX ?? item.position.x) + offsetX,
                    y: (itemsMap.get(item.id)?.startY ?? item.position.y) + offsetY,
                  },
                }
              : item,
          )
          return {
            ...prev,
            elements: nextElements,
            connectors: syncConnectorEndpoints(prev.connectors, nextElements),
          }
        },
        { skipHistory: true, skipSync: true },
      )
    }
    const handleUp = (event: PointerEvent) => {
      if (connectorDraftRef.current) {
        const draft = connectorDraftRef.current
        connectorDraftRef.current = null
        setDraftConnector(null)
        const position = toWorldPosition(event.clientX, event.clientY)
        let end: FlowElementPosition = {
          x: applySnap(position.x),
          y: applySnap(position.y),
        }
        let toId = draft.toId
        let toAnchor = draft.toAnchor
        const targetElement = findElementAtPosition(position)
        if (targetElement) {
          const anchor = findClosestAnchor(targetElement, position)
          const anchorPosition = getAnchorPosition(
            targetElement,
            anchor,
            ANCHOR_OFFSET + targetElement.style.strokeWidth,
          )
          end = { x: anchorPosition.x, y: anchorPosition.y }
          toId = targetElement.id
          toAnchor = anchor
        }
        const distance = Math.hypot(end.x - draft.start.x, end.y - draft.start.y)
        if (distance > 6) {
          const nextConnector: FlowConnector = {
            id: createId(),
            fromId: draft.fromId,
            fromAnchor: draft.fromAnchor,
            toId,
            toAnchor,
            label: draft.label,
            points: [draft.start, end],
            style: draft.style,
          }
          commitState((prev) => ({
            ...prev,
            connectors: [...prev.connectors, nextConnector],
          }))
          setSelectedConnectorId(nextConnector.id)
          setSelectedElementIds([])
        }
      }
      if (connectorHandleRef.current) {
        const handle = connectorHandleRef.current
        connectorHandleRef.current = null
        const position = toWorldPosition(event.clientX, event.clientY)
        const targetElement = findElementAtPosition(position)
        let end: FlowElementPosition = {
          x: applySnap(position.x),
          y: applySnap(position.y),
        }
        let fromId: string | undefined
        let fromAnchor: FlowAnchor | undefined
        let toId: string | undefined
        let toAnchor: FlowAnchor | undefined
        if (targetElement) {
          const anchor = findClosestAnchor(targetElement, position)
          const anchorPosition = getAnchorPosition(
            targetElement,
            anchor,
            ANCHOR_OFFSET + targetElement.style.strokeWidth,
          )
          end = { x: anchorPosition.x, y: anchorPosition.y }
          if (handle.handle === 'start') {
            fromId = targetElement.id
            fromAnchor = anchor
          } else {
            toId = targetElement.id
            toAnchor = anchor
          }
        }
        commitState((prev) => ({
          ...prev,
          connectors: prev.connectors.map((connector) => {
            if (connector.id !== handle.connectorId) {
              return connector
            }
            const points = connector.points ? [...connector.points] : [end, end]
            if (handle.handle === 'start') {
              points[0] = end
              return {
                ...connector,
                fromId,
                fromAnchor,
                points,
              }
            }
            points[points.length - 1] = end
            return {
              ...connector,
              toId,
              toAnchor,
              points,
            }
          }),
        }))
      }
      if (selectionRef.current) {
        const selection = selectionRef.current
        selectionRef.current = null
        setSelectionBox(null)
        const minX = Math.min(selection.start.x, selection.end.x)
        const minY = Math.min(selection.start.y, selection.end.y)
        const maxX = Math.max(selection.start.x, selection.end.x)
        const maxY = Math.max(selection.start.y, selection.end.y)
        const hits = stateRef.current.elements
          .filter((element) => {
            const elementRight = element.position.x + element.size.width
            const elementBottom = element.position.y + element.size.height
            return (
              element.position.x < maxX &&
              elementRight > minX &&
              element.position.y < maxY &&
              elementBottom > minY
            )
          })
          .map((element) => element.id)
        setSelectedConnectorId(null)
        setSelectedElementIds((prev) => {
          if (selection.additive) {
            const merged = new Set(prev)
            hits.forEach((id) => merged.add(id))
            return Array.from(merged)
          }
          return hits
        })
      }
      const shouldSync = !!dragRef.current || !!panRef.current
      if (dragRef.current) {
        const hadMovement = dragRef.current.hasMoved
        dragRef.current = null
        if (hadMovement) {
          pushHistory(stateRef.current)
        }
      }
      if (panRef.current) {
        panRef.current = null
      }
      if (shouldSync) {
        syncHandlerRef.current?.(stateRef.current)
      }
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [applySnap, commitState, findElementAtPosition, toWorldPosition])

  const handleDuplicate = () => {
    if (selectedElementIds.length === 0) {
      return
    }
    const selectedIds = new Set(selectedElementIds)
    const source = stateRef.current.elements.filter((item) => selectedIds.has(item.id))
    if (source.length === 0) {
      return
    }
    const offset = state.settings.gridSize
    const duplicates = source.map((item) => ({
      ...item,
      id: createId(),
      position: {
        x: item.position.x + offset,
        y: item.position.y + offset,
      },
    }))
    commitState((prev) => ({ ...prev, elements: [...prev.elements, ...duplicates] }))
    setSelectedElementIds(duplicates.map((item) => item.id))
    setSelectedConnectorId(null)
  }

  const handleDelete = () => {
    if (selectedElementIds.length > 0) {
      const selectedIds = new Set(selectedElementIds)
      commitState((prev) => ({
        ...prev,
        elements: prev.elements.filter((item) => !selectedIds.has(item.id)),
        connectors: prev.connectors.filter(
          (connector) =>
            !selectedIds.has(connector.fromId ?? '') && !selectedIds.has(connector.toId ?? ''),
        ),
      }))
      setSelectedElementIds([])
      setSelectedConnectorId(null)
      return
    }
    if (selectedConnectorId) {
      commitState((prev) => ({
        ...prev,
        connectors: prev.connectors.filter((connector) => connector.id !== selectedConnectorId),
      }))
      setSelectedConnectorId(null)
    }
  }

  const handleZoom = (delta: number) => {
    commitState((prev) => ({
      ...prev,
      viewport: {
        ...prev.viewport,
        zoom: Math.min(3, Math.max(0.35, prev.viewport.zoom + delta)),
      },
    }))
  }

  const handleZoomPreset = (value: number) => {
    commitState((prev) => ({
      ...prev,
      viewport: {
        ...prev.viewport,
        zoom: Math.min(3, Math.max(0.35, value)),
      },
    }))
  }

  const handleResetView = () => {
    commitState(
      (prev) => ({
        ...prev,
        viewport: {
          ...prev.viewport,
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
        },
      }),
      { skipHistory: true },
    )
  }

  const handleFitToContent = () => {
    const canvas = canvasRef.current
    const elements = stateRef.current.elements
    if (!canvas || elements.length === 0) {
      handleResetView()
      return
    }
    const minX = Math.min(...elements.map((item) => item.position.x))
    const minY = Math.min(...elements.map((item) => item.position.y))
    const maxX = Math.max(...elements.map((item) => item.position.x + item.size.width))
    const maxY = Math.max(...elements.map((item) => item.position.y + item.size.height))
    const padding = 80
    const contentWidth = Math.max(1, maxX - minX)
    const contentHeight = Math.max(1, maxY - minY)
    const availableWidth = Math.max(1, canvas.clientWidth - padding * 2)
    const availableHeight = Math.max(1, canvas.clientHeight - padding * 2)
    const nextZoom = Math.min(
      3,
      Math.max(0.35, Math.min(availableWidth / contentWidth, availableHeight / contentHeight)),
    )
    const nextOffsetX = padding + (availableWidth - contentWidth * nextZoom) / 2 - minX * nextZoom
    const nextOffsetY = padding + (availableHeight - contentHeight * nextZoom) / 2 - minY * nextZoom
    commitState(
      (prev) => ({
        ...prev,
        viewport: {
          ...prev.viewport,
          zoom: nextZoom,
          offsetX: nextOffsetX,
          offsetY: nextOffsetY,
        },
      }),
      { skipHistory: true },
    )
  }

  const handleToggleFocus = () => {
    if (!isFocusMode) {
      restoreLayoutRef.current = {
        top: isTopVisible,
        left: isLeftVisible,
        right: isRightVisible,
        rightCollapsed: isRightCollapsed,
        bottom: isBottomVisible,
      }
      setIsTopVisible(false)
      setIsLeftVisible(false)
      setIsRightVisible(false)
      setIsRightCollapsed(false)
      setIsBottomVisible(false)
      setIsFocusMode(true)
      return
    }
    setIsTopVisible(restoreLayoutRef.current.top)
    setIsLeftVisible(restoreLayoutRef.current.left)
    setIsRightVisible(restoreLayoutRef.current.right)
    setIsRightCollapsed(restoreLayoutRef.current.rightCollapsed)
    setIsBottomVisible(restoreLayoutRef.current.bottom)
    setIsFocusMode(false)
  }

  const handleLayoutReveal = (region: 'top' | 'left' | 'right' | 'bottom') => {
    if (region === 'top') setIsTopVisible(true)
    if (region === 'left') setIsLeftVisible(true)
    if (region === 'right') {
      setIsRightVisible(true)
      setIsRightCollapsed(false)
    }
    if (region === 'bottom') setIsBottomVisible(true)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) {
          return
        }
      }
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          handleRedo()
          return
        }
        handleUndo()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        handleRedo()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        handleDelete()
        return
      }
      if (event.key.toLowerCase() === 'x') {
        event.preventDefault()
        handleDelete()
        return
      }
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault()
        if (event.altKey) {
          setSelectedElementIds([])
          setSelectedConnectorId(null)
          return
        }
        const allIds = stateRef.current.elements.map((item) => item.id)
        if (selectedElementIds.length === allIds.length) {
          setSelectedElementIds([])
        } else {
          setSelectedElementIds(allIds)
        }
        setSelectedConnectorId(null)
        return
      }
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setActiveTool('select')
        return
      }
      if (event.key === 'Escape') {
        if (connectorDraftRef.current) {
          connectorDraftRef.current = null
          setDraftConnector(null)
        }
        if (connectorHandleRef.current) {
          connectorHandleRef.current = null
        }
        if (selectionRef.current) {
          selectionRef.current = null
          setSelectionBox(null)
        }
        setActiveTool('select')
        setSelectedConnectorId(null)
        setSelectedElementIds([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDelete, handleRedo, handleUndo, selectedElementIds])

  const searchItems = useMemo(
    () =>
      state.elements.map((element) => ({
        id: element.id,
        title: element.label || 'Elemento',
        subtitle: element.type,
        category: 'Elementos',
        keywords: [element.label, element.type],
      })),
    [state.elements],
  )

  const canvasStyle: CSSProperties = {
    '--grid-size': `${gridSizePx}px`,
    '--grid-major-size': `${gridSizePx * 4}px`,
    '--grid-offset-x': `${state.viewport.offsetX}px`,
    '--grid-offset-y': `${state.viewport.offsetY}px`,
  } as CSSProperties

  const contentStyle: CSSProperties = {
    transform: `translate(${state.viewport.offsetX}px, ${state.viewport.offsetY}px) scale(${canvasZoom})`,
  }

  const selectionBounds = useMemo(() => {
    if (!selectionBox) {
      return null
    }
    const left = Math.min(selectionBox.start.x, selectionBox.end.x)
    const top = Math.min(selectionBox.start.y, selectionBox.end.y)
    const width = Math.abs(selectionBox.end.x - selectionBox.start.x)
    const height = Math.abs(selectionBox.end.y - selectionBox.start.y)
    return { left, top, width, height }
  }, [selectionBox])

  if (!isAuthenticated) {
    if (isRecoveryMode) {
      return <ResetPassword onDone={() => setIsRecoveryMode(false)} />
    }
    return (
      <Login
        onLogin={(user) => void startSession(user)}
        onDevLogin={allowDevMode ? () => handleDevLogin() : undefined}
      />
    )
  }

  return (
    <div className={`pas ${isFocusMode ? 'pas--focus' : ''}`}>
      <div className={`pas__topbar ${isTopVisible ? '' : 'is-hidden'}`}>
        <Topbar
          breadcrumbs={['PAS', 'Fluxograma']}
          brand={<img className="topbar__logo" src={logotipo} alt="Umoya" />}
          userName={resolveDisplayName(currentUser)}
          userRoleLabel="PAS"
          onLogout={handleLogout}
          showSensitiveToggle={false}
          showNotifications={false}
          searchItems={searchItems}
          onSearchSelect={(item) => {
            setSelectedElementIds([item.id])
            setSelectedConnectorId(null)
          }}
          searchPlaceholder="Buscar elementos"
        />
      </div>

      <div className={`pas__toolbar ${isTopVisible ? '' : 'is-hidden'}`}>
        <div className={`pas__toolbar-group ${openToolbarPanel === 'text' ? 'is-open' : ''}`}>
          <button
            type="button"
            className="pas__toolbar-toggle"
            onClick={() => toggleToolbarPanel('text')}
          >
            <span className="material-symbols-outlined">text_fields</span>
            <span>Texto</span>
          </button>
          <div className="pas__toolbar-panel">
            <div className="pas__toolbar-panel-title">Texto</div>
            <div className="pas__toolbar-row">
              <select
                className="pas__toolbar-select"
                value={elementStyle.fontFamily}
                onChange={(event) => updateElementStyle({ fontFamily: event.target.value })}
              >
                {FONT_FAMILIES.map((family) => (
                  <option key={family.id} value={family.value}>
                    {family.label}
                  </option>
                ))}
              </select>
              <select
                className="pas__toolbar-select"
                value={elementStyle.fontSize}
                onChange={(event) => updateElementStyle({ fontSize: Number(event.target.value) })}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
            <div className="pas__toolbar-row">
              <button
                type="button"
                className={`pas__tool-button ${elementStyle.fontWeight === 'bold' ? 'is-active' : ''}`}
                onClick={() =>
                  updateElementStyle({
                    fontWeight: elementStyle.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
              >
                <span className="material-symbols-outlined">format_bold</span>
              </button>
              <button
                type="button"
                className={`pas__tool-button ${elementStyle.fontStyle === 'italic' ? 'is-active' : ''}`}
                onClick={() =>
                  updateElementStyle({
                    fontStyle: elementStyle.fontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
              >
                <span className="material-symbols-outlined">format_italic</span>
              </button>
              <button
                type="button"
                className={`pas__tool-button ${elementStyle.textAlign === 'left' ? 'is-active' : ''}`}
                onClick={() => updateElementStyle({ textAlign: 'left' })}
              >
                <span className="material-symbols-outlined">format_align_left</span>
              </button>
              <button
                type="button"
                className={`pas__tool-button ${elementStyle.textAlign === 'center' ? 'is-active' : ''}`}
                onClick={() => updateElementStyle({ textAlign: 'center' })}
              >
                <span className="material-symbols-outlined">format_align_center</span>
              </button>
              <button
                type="button"
                className={`pas__tool-button ${elementStyle.textAlign === 'right' ? 'is-active' : ''}`}
                onClick={() => updateElementStyle({ textAlign: 'right' })}
              >
                <span className="material-symbols-outlined">format_align_right</span>
              </button>
            </div>
          </div>
        </div>

        <div className={`pas__toolbar-group ${openToolbarPanel === 'colors' ? 'is-open' : ''}`}>
          <button
            type="button"
            className="pas__toolbar-toggle"
            onClick={() => toggleToolbarPanel('colors')}
          >
            <span className="material-symbols-outlined">palette</span>
            <span>Cores</span>
          </button>
          <div className="pas__toolbar-panel">
            <div className="pas__toolbar-panel-title">Cores</div>
            <div className="pas__toolbar-row">
              <label className="pas__color-field">
                <span>Preenchimento</span>
                <input
                  type="color"
                  value={elementStyle.fill}
                  onChange={(event) => updateElementStyle({ fill: event.target.value })}
                />
              </label>
              <label className="pas__color-field">
                <span>Borda</span>
                <input
                  type="color"
                  value={elementStyle.stroke}
                  onChange={(event) => updateElementStyle({ stroke: event.target.value })}
                />
              </label>
              <label className="pas__color-field">
                <span>Texto</span>
                <input
                  type="color"
                  value={elementStyle.textColor}
                  onChange={(event) => updateElementStyle({ textColor: event.target.value })}
                />
              </label>
            </div>
          </div>
        </div>

        <div className={`pas__toolbar-group ${openToolbarPanel === 'line' ? 'is-open' : ''}`}>
          <button
            type="button"
            className="pas__toolbar-toggle"
            onClick={() => toggleToolbarPanel('line')}
          >
            <span className="material-symbols-outlined">polyline</span>
            <span>Linha</span>
          </button>
          <div className="pas__toolbar-panel">
            <div className="pas__toolbar-panel-title">Linha</div>
            <div className="pas__toolbar-row">
              <label className="pas__color-field">
                <span>Linha</span>
                <input
                  type="color"
                  value={lineStyle.stroke}
                  onChange={(event) => updateConnectorStyle({ stroke: event.target.value })}
                />
              </label>
              <select
                className="pas__toolbar-select"
                value={lineStyle.lineStyle}
                onChange={(event) =>
                  updateConnectorStyle({ lineStyle: event.target.value as FlowLineStyle })
                }
              >
                {LINE_STYLES.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </select>
              <select
                className="pas__toolbar-select"
                value={lineStyle.lineShape}
                onChange={(event) =>
                  updateConnectorStyle({ lineShape: event.target.value as FlowLineShape })
                }
              >
                {LINE_SHAPES.map((shape) => (
                  <option key={shape.id} value={shape.id}>
                    {shape.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pas__toolbar-row">
              <select
                className="pas__toolbar-select"
                value={lineStyle.strokeWidth}
                onChange={(event) =>
                  updateConnectorStyle({ strokeWidth: Number(event.target.value) })
                }
              >
                {LINE_WIDTHS.map((width) => (
                  <option key={width} value={width}>
                    {width}px
                  </option>
                ))}
              </select>
              <select
                className="pas__toolbar-select"
                value={lineStyle.startArrow}
                onChange={(event) =>
                  updateConnectorStyle({ startArrow: event.target.value as FlowArrowStyle })
                }
              >
                {ARROW_STYLES.map((arrow) => (
                  <option key={`start-${arrow.id}`} value={arrow.id}>
                    Inicio: {arrow.label}
                  </option>
                ))}
              </select>
              <select
                className="pas__toolbar-select"
                value={lineStyle.endArrow}
                onChange={(event) =>
                  updateConnectorStyle({ endArrow: event.target.value as FlowArrowStyle })
                }
              >
                {ARROW_STYLES.map((arrow) => (
                  <option key={`end-${arrow.id}`} value={arrow.id}>
                    Fim: {arrow.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pas__toolbar-row">
              <select
                className="pas__toolbar-select"
                value={lineStyle.labelPlacement}
                onChange={(event) =>
                  updateConnectorStyle({
                    labelPlacement: event.target.value as FlowConnectorStyle['labelPlacement'],
                  })
                }
              >
                {LINE_LABEL_PLACEMENTS.map((placement) => (
                  <option key={placement.id} value={placement.id}>
                    {placement.label}
                  </option>
                ))}
              </select>
              <label className="pas__text-field">
                <span>Texto</span>
                <input
                  type="text"
                  value={lineLabel}
                  onChange={(event) => updateConnectorLabel(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={`pas__tool-button ${lineStyle.hasLineJump ? 'is-active' : ''}`}
                onClick={() => updateConnectorStyle({ hasLineJump: !lineStyle.hasLineJump })}
              >
                <span className="material-symbols-outlined">line_end_circle</span>
                <span className="pas__tool-button-label">Salto</span>
              </button>
            </div>
          </div>
        </div>

        <div className={`pas__toolbar-group ${openToolbarPanel === 'actions' ? 'is-open' : ''}`}>
          <button
            type="button"
            className="pas__toolbar-toggle"
            onClick={() => toggleToolbarPanel('actions')}
          >
            <span className="material-symbols-outlined">tune</span>
            <span>Acoes</span>
          </button>
          <div className="pas__toolbar-panel">
            <div className="pas__toolbar-panel-title">Acoes</div>
            <div className="pas__toolbar-row">
              <button
                type="button"
                className="pas__tool-button"
                onClick={handleDuplicate}
                disabled={selectedElementCount === 0}
                title="Duplicar elemento"
              >
                <span className="material-symbols-outlined">content_copy</span>
              </button>
              <button
                type="button"
                className="pas__tool-button"
                onClick={handleDelete}
                disabled={selectedElementCount === 0 && !selectedConnector}
                title="Excluir selecionado"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
              <button
                type="button"
                className={`pas__tool-button ${state.settings.snapToGrid ? 'is-active' : ''}`}
                onClick={() =>
                  commitState((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      snapToGrid: !prev.settings.snapToGrid,
                    },
                  }))
                }
                title={state.settings.snapToGrid ? 'Desativar snap' : 'Ativar snap'}
              >
                <span className="material-symbols-outlined">grid_on</span>
              </button>
            </div>
            <div className="pas__toolbar-row">
              <button
                type="button"
                className="pas__tool-button"
                onClick={handleResetView}
                title="Centralizar canvas"
              >
                <span className="material-symbols-outlined">center_focus_strong</span>
              </button>
              <button
                type="button"
                className="pas__tool-button"
                onClick={handleFitToContent}
                title="Ajustar ao conteudo"
              >
                <span className="material-symbols-outlined">fit_screen</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`pas__workspace ${isLeftVisible ? '' : 'is-left-hidden'} ${
          isRightVisible ? '' : 'is-right-hidden'
        } ${isRightCollapsed ? 'is-right-collapsed' : ''}`}
      >
        <aside className={`pas__sidebar pas__sidebar--left ${isLeftVisible ? '' : 'is-hidden'}`}>
          <div className="pas__sidebar-title">Ferramentas</div>
          {TOOL_SECTIONS.map((section) => (
            <div key={section.id} className="pas__tool-section">
              <div className="pas__tool-section-title">{section.label}</div>
              <div className="pas__tool-grid">
                {section.tools.map((tool) => {
                  const isDraggable = !!tool.elementType
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={`pas__tool-card ${activeTool === tool.id ? 'is-active' : ''}`}
                      onClick={() => setActiveTool(tool.id)}
                      onDragStart={
                        isDraggable ? (event) => handleToolDragStart(event, tool.id) : undefined
                      }
                      draggable={isDraggable}
                    >
                      <span className="material-symbols-outlined">{tool.icon}</span>
                      <span>{tool.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>

        <main className="pas__canvas" ref={canvasRef} data-tool={activeTool}>
          <div
            className="pas__canvas-grid"
            style={canvasStyle}
            onPointerDown={handleCanvasPointerDown}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onWheel={handleCanvasWheel}
          >
            <div className="pas__canvas-content" style={contentStyle}>
              <svg className="pas__connector-layer">
                <defs>
                  <marker
                    id="pas-marker-arrow"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                  </marker>
                  <marker
                    id="pas-marker-triangle"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                  </marker>
                  <marker
                    id="pas-marker-circle"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <circle cx="5" cy="5" r="4" fill="currentColor" />
                  </marker>
                  <marker
                    id="pas-marker-diamond"
                    viewBox="0 0 12 12"
                    refX="6"
                    refY="6"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="currentColor" />
                  </marker>
                  <marker
                    id="pas-marker-bar"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 5 0 L 5 10" stroke="currentColor" strokeWidth="2" />
                  </marker>
                </defs>
                {state.connectors.map((connector) => {
                  const points = connector.points ?? []
                  if (points.length < 2) {
                    return null
                  }
                  const start = points[0]
                  const end = points[points.length - 1]
                  const path = resolveConnectorPath(start, end, connector.style.lineShape)
                  const isSelected = connector.id === selectedConnectorId
                  const dashArray = resolveDashArray(
                    connector.style.lineStyle,
                    connector.style.strokeWidth,
                  )
                  const markerStart = resolveMarkerId(connector.style.startArrow)
                  const markerEnd = resolveMarkerId(connector.style.endArrow)
                  const label = connector.label?.trim()
                  const showLabel = label && connector.style.labelPlacement !== 'none'
                  const labelPosition = showLabel
                    ? resolveLabelPosition(start, end, connector.style.labelPlacement)
                    : null
                  const isDouble = connector.style.lineStyle === 'double'
                  const jumpSegment = connector.style.hasLineJump
                    ? resolveJumpSegment(start, end)
                    : null

                  return (
                    <g key={connector.id} className="pas__connector-group">
                      {isSelected && (
                        <path
                          className="pas__connector-highlight"
                          d={path}
                          strokeWidth={connector.style.strokeWidth + 6}
                        />
                      )}
                      {isDouble ? (
                        <>
                          <path
                            className="pas__connector"
                            d={path}
                            stroke={connector.style.stroke}
                            strokeWidth={connector.style.strokeWidth * 2.4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            markerStart={markerStart}
                            markerEnd={markerEnd}
                            color={connector.style.stroke}
                          />
                          <path
                            className="pas__connector"
                            d={path}
                            stroke="var(--pas-canvas)"
                            strokeWidth={Math.max(1, connector.style.strokeWidth)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      ) : (
                        <path
                          className="pas__connector"
                          d={path}
                          stroke={connector.style.stroke}
                          strokeWidth={connector.style.strokeWidth}
                          strokeDasharray={dashArray}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerStart={markerStart}
                          markerEnd={markerEnd}
                          color={connector.style.stroke}
                        />
                      )}
                      {jumpSegment && (
                        <path
                          className="pas__connector-jump"
                          d={`M ${jumpSegment.start.x} ${jumpSegment.start.y} L ${jumpSegment.end.x} ${jumpSegment.end.y}`}
                          strokeWidth={Math.max(6, connector.style.strokeWidth + 4)}
                        />
                      )}
                      {showLabel && labelPosition && (
                        <text
                          className="pas__connector-label"
                          x={labelPosition.x}
                          y={labelPosition.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {label}
                        </text>
                      )}
                      <path
                        className="pas__connector-hit"
                        d={path}
                        strokeWidth={Math.max(12, connector.style.strokeWidth + 8)}
                        onPointerDown={(event) => handleConnectorPointerDown(event, connector)}
                      />
                      {isSelected && (
                        <>
                          <circle
                            className="pas__connector-handle"
                            cx={start.x}
                            cy={start.y}
                            r={6}
                            onPointerDown={(event) =>
                              handleConnectorHandlePointerDown(event, connector, 'start')
                            }
                          />
                          <circle
                            className="pas__connector-handle"
                            cx={end.x}
                            cy={end.y}
                            r={6}
                            onPointerDown={(event) =>
                              handleConnectorHandlePointerDown(event, connector, 'end')
                            }
                          />
                        </>
                      )}
                    </g>
                  )
                })}
                {draftConnector && (
                  <path
                    className="pas__connector-draft"
                    d={resolveConnectorPath(
                      draftConnector.start,
                      draftConnector.end,
                      draftConnector.style.lineShape,
                    )}
                    stroke={draftConnector.style.stroke}
                    strokeWidth={draftConnector.style.strokeWidth}
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerStart={resolveMarkerId(draftConnector.style.startArrow)}
                    markerEnd={resolveMarkerId(draftConnector.style.endArrow)}
                    color={draftConnector.style.stroke}
                  />
                )}
              </svg>
              {state.elements.map((element) => (
                <div
                  key={element.id}
                  className={`pas__element ${
                    selectedElementIds.includes(element.id) ? 'is-selected' : ''
                  }`}
                  data-shape={element.type}
                  style={{
                    left: element.position.x,
                    top: element.position.y,
                    width: element.size.width,
                    height: element.size.height,
                    background: element.type === 'text' ? 'transparent' : element.style.fill,
                    borderColor: element.style.stroke,
                    color: element.style.textColor,
                    borderWidth: element.style.strokeWidth,
                    borderStyle: element.type === 'text' ? 'dashed' : 'solid',
                    fontSize: element.style.fontSize,
                    fontFamily: element.style.fontFamily,
                    fontWeight: element.style.fontWeight,
                    fontStyle: element.style.fontStyle,
                    textAlign: element.style.textAlign,
                  }}
                  onPointerDown={(event) => handleElementPointerDown(event, element)}
                  onDoubleClick={(event) => {
                    if (editingElementId === element.id) {
                      return
                    }
                    event.stopPropagation()
                    startEditingElement(element)
                  }}
                  onPointerEnter={() => setHoveredElementId(element.id)}
                  onPointerLeave={() =>
                    setHoveredElementId((prev) => (prev === element.id ? null : prev))
                  }
                >
                  {editingElementId === element.id ? (
                    element.type === 'note' ? (
                      <textarea
                        className="pas__element-input"
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        onBlur={() => finishEditingElement(true)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            finishEditingElement(false)
                          }
                          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                            event.preventDefault()
                            finishEditingElement(true)
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <input
                        className="pas__element-input"
                        type="text"
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        onBlur={() => finishEditingElement(true)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            finishEditingElement(false)
                          }
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            finishEditingElement(true)
                          }
                        }}
                        autoFocus
                      />
                    )
                  ) : (
                    <span className="pas__element-label">{element.label}</span>
                  )}
                  <div
                    className={`pas__anchor-layer ${
                      activeTool === 'arrow' ||
                      selectedElementIds.includes(element.id) ||
                      hoveredElementId === element.id
                        ? 'is-visible'
                        : ''
                    }`}
                  >
                    {ANCHOR_POINTS.map((anchor) => {
                      const anchorPoint = getAnchorBasePosition(element, anchor)
                      return (
                        <button
                          key={`${element.id}-${anchor}`}
                          type="button"
                          className="pas__anchor"
                          style={{
                            left: anchorPoint.x - element.position.x,
                            top: anchorPoint.y - element.position.y,
                          }}
                          onPointerDown={(event) => handleAnchorPointerDown(event, element, anchor)}
                          onDoubleClick={(event) => event.stopPropagation()}
                          aria-label={`Ponto ${anchor}`}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
              {selectionBounds && (
                <div
                  className="pas__selection-rect"
                  style={{
                    left: selectionBounds.left,
                    top: selectionBounds.top,
                    width: selectionBounds.width,
                    height: selectionBounds.height,
                  }}
                />
              )}
            </div>
          </div>

          {!isTopVisible && (
            <button
              type="button"
              className="pas__edge-toggle pas__edge-toggle--top"
              onClick={() => handleLayoutReveal('top')}
            >
              <span className="material-symbols-outlined">expand_more</span>
            </button>
          )}
          {!isLeftVisible && (
            <button
              type="button"
              className="pas__edge-toggle pas__edge-toggle--left"
              onClick={() => handleLayoutReveal('left')}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          )}
          {!isRightVisible && (
            <button
              type="button"
              className="pas__edge-toggle pas__edge-toggle--right"
              onClick={() => handleLayoutReveal('right')}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          )}
          {!isBottomVisible && (
            <button
              type="button"
              className="pas__edge-toggle pas__edge-toggle--bottom"
              onClick={() => handleLayoutReveal('bottom')}
            >
              <span className="material-symbols-outlined">expand_less</span>
            </button>
          )}

          {isFocusMode && (
            <button
              type="button"
              className="pas__floating-fullscreen"
              onClick={handleToggleFocus}
            >
              <span className="material-symbols-outlined">close_fullscreen</span>
            </button>
          )}
        </main>

        <aside
          className={`pas__sidebar pas__sidebar--right ${isRightVisible ? '' : 'is-hidden'} ${
            isRightCollapsed ? 'is-collapsed' : ''
          }`}
        >
          <div className="pas__sidebar-header">
            <div className="pas__sidebar-title">Inspector</div>
            <div className="pas__sidebar-actions">
              <button
                type="button"
                className="pas__icon-button"
                onClick={handleRightCollapse}
                aria-label={isRightCollapsed ? 'Expandir painel' : 'Minimizar painel'}
              >
                <span className="material-symbols-outlined">
                  {isRightCollapsed ? 'chevron_left' : 'chevron_right'}
                </span>
              </button>
              <button
                type="button"
                className="pas__icon-button"
                onClick={handleRightClose}
                aria-label="Fechar painel"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
          {!isRightCollapsed &&
            (selectedConnector ? (
              <div className="pas__inspector">
                <div className="pas__inspector-row">
                  <label>Texto</label>
                  <input
                    type="text"
                    value={selectedConnector.label ?? ''}
                    onChange={(event) => updateConnectorLabel(event.target.value)}
                  />
                </div>
                <div className="pas__inspector-row">
                  <label>Tipo</label>
                  <input type="text" value="Linha" disabled />
                </div>
                <div className="pas__inspector-grid">
                  {(() => {
                    const points = selectedConnector.points ?? [
                      { x: 0, y: 0 },
                      { x: 0, y: 0 },
                    ]
                    const start = points[0]
                    const end = points[points.length - 1]
                    return (
                      <>
                        <div>
                          <label>X1</label>
                          <input
                            type="number"
                            value={Math.round(start.x)}
                            onChange={(event) => {
                              const value = Number(event.target.value)
                              const nextPoints = [...points]
                              nextPoints[0] = { ...nextPoints[0], x: value }
                              updateSelectedConnector({
                                fromId: undefined,
                                fromAnchor: undefined,
                                points: nextPoints,
                              })
                            }}
                          />
                        </div>
                        <div>
                          <label>Y1</label>
                          <input
                            type="number"
                            value={Math.round(start.y)}
                            onChange={(event) => {
                              const value = Number(event.target.value)
                              const nextPoints = [...points]
                              nextPoints[0] = { ...nextPoints[0], y: value }
                              updateSelectedConnector({
                                fromId: undefined,
                                fromAnchor: undefined,
                                points: nextPoints,
                              })
                            }}
                          />
                        </div>
                        <div>
                          <label>X2</label>
                          <input
                            type="number"
                            value={Math.round(end.x)}
                            onChange={(event) => {
                              const value = Number(event.target.value)
                              const nextPoints = [...points]
                              nextPoints[nextPoints.length - 1] = {
                                ...nextPoints[nextPoints.length - 1],
                                x: value,
                              }
                              updateSelectedConnector({
                                toId: undefined,
                                toAnchor: undefined,
                                points: nextPoints,
                              })
                            }}
                          />
                        </div>
                        <div>
                          <label>Y2</label>
                          <input
                            type="number"
                            value={Math.round(end.y)}
                            onChange={(event) => {
                              const value = Number(event.target.value)
                              const nextPoints = [...points]
                              nextPoints[nextPoints.length - 1] = {
                                ...nextPoints[nextPoints.length - 1],
                                y: value,
                              }
                              updateSelectedConnector({
                                toId: undefined,
                                toAnchor: undefined,
                                points: nextPoints,
                              })
                            }}
                          />
                        </div>
                      </>
                    )
                  })()}
                </div>
                <div className="pas__inspector-note">
                  Ajuste rapido do texto e dos pontos da linha selecionada.
                </div>
              </div>
            ) : selectedElementCount > 1 ? (
              <div className="pas__inspector">
                <div className="pas__inspector-row">
                  <label>Selecao</label>
                  <input type="text" value={`${selectedElementCount} elementos`} disabled />
                </div>
                <div className="pas__inspector-note">
                  Use a barra de ferramentas para aplicar estilos em grupo.
                </div>
              </div>
            ) : selectedElement ? (
              <div className="pas__inspector">
                <div className="pas__inspector-row">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={selectedElement.label}
                    onChange={(event) => updateSelectedElement({ label: event.target.value })}
                  />
                </div>
                <div className="pas__inspector-row">
                  <label>Tipo</label>
                  <input type="text" value={selectedElement.type} disabled />
                </div>
                <div className="pas__inspector-grid">
                  <div>
                    <label>X</label>
                    <input
                      type="number"
                      value={Math.round(selectedElement.position.x)}
                      onChange={(event) =>
                        updateSelectedElement({
                          position: {
                            ...selectedElement.position,
                            x: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label>Y</label>
                    <input
                      type="number"
                      value={Math.round(selectedElement.position.y)}
                      onChange={(event) =>
                        updateSelectedElement({
                          position: {
                            ...selectedElement.position,
                            y: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label>W</label>
                    <input
                      type="number"
                      value={Math.round(selectedElement.size.width)}
                      onChange={(event) =>
                        updateSelectedElement({
                          size: {
                            ...selectedElement.size,
                            width: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label>H</label>
                    <input
                      type="number"
                      value={Math.round(selectedElement.size.height)}
                      onChange={(event) =>
                        updateSelectedElement({
                          size: {
                            ...selectedElement.size,
                            height: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="pas__inspector-note">
                  Ajuste rapido de propriedades do elemento selecionado.
                </div>
              </div>
            ) : (
              <div className="pas__inspector-empty">
                Selecione um elemento ou linha para editar propriedades.
              </div>
            ))}
        </aside>
      </div>

      <div className={`pas__bottombar ${isBottomVisible ? '' : 'is-hidden'}`}>
        <div className="pas__bottombar-group">
          <button
            type="button"
            className="pas__tool-button"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button
            type="button"
            className="pas__tool-button"
            onClick={handleRedo}
            disabled={!canRedo}
          >
            <span className="material-symbols-outlined">redo</span>
          </button>
        </div>

        <div className="pas__bottombar-group">
          <button type="button" className="pas__tool-button" onClick={() => handleZoom(-0.1)}>
            <span className="material-symbols-outlined">remove</span>
          </button>
          <button type="button" className="pas__zoom-pill" onClick={() => handleZoomPreset(1)}>
            {Math.round(canvasZoom * 100)}%
          </button>
          <button type="button" className="pas__tool-button" onClick={() => handleZoom(0.1)}>
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>

        <div className="pas__bottombar-group">
          <button type="button" className="pas__tool-button" onClick={handleToggleFocus}>
            <span className="material-symbols-outlined">
              {isFocusMode ? 'close_fullscreen' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default PasApp
