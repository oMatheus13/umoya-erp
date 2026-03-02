export type FlowViewport = {
  offsetX: number
  offsetY: number
  zoom: number
}

export type FlowElementType =
  | 'text'
  | 'note'
  | 'terminator'
  | 'process'
  | 'decision'
  | 'data'
  | 'document'
  | 'manual-input'
  | 'predefined-process'
  | 'database'
  | 'connector'
  | 'off-page'
  | 'rectangle'
  | 'rounded'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'parallelogram'
  | 'star'

export type FlowElementPosition = {
  x: number
  y: number
}

export type FlowElementSize = {
  width: number
  height: number
}

export type FlowLineStyle = 'solid' | 'dashed' | 'dotted' | 'double'
export type FlowLineShape = 'straight' | 'orthogonal' | 'curved' | 'elbow'
export type FlowArrowStyle = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'bar'
export type FlowAnchor =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'

export type FlowElementStyle = {
  fill: string
  stroke: string
  textColor: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right'
}

export type FlowElement = {
  id: string
  type: FlowElementType
  label: string
  position: FlowElementPosition
  size: FlowElementSize
  style: FlowElementStyle
}

export type FlowConnectorStyle = {
  stroke: string
  strokeWidth: number
  lineStyle: FlowLineStyle
  lineShape: FlowLineShape
  startArrow: FlowArrowStyle
  endArrow: FlowArrowStyle
  hasLineJump: boolean
  labelPlacement: 'none' | 'center' | 'source' | 'target'
}

export type FlowConnector = {
  id: string
  fromId?: string
  fromAnchor?: FlowAnchor
  toId?: string
  toAnchor?: FlowAnchor
  label?: string
  points?: Array<{ x: number; y: number }>
  style: FlowConnectorStyle
}

export type PasState = {
  viewport: FlowViewport
  elements: FlowElement[]
  connectors: FlowConnector[]
  settings: {
    snapToGrid: boolean
    gridSize: number
  }
}
