type BeepOptions = {
  frequency?: number
  durationMs?: number
  volume?: number
  type?: OscillatorType
}

let audioContext: AudioContext | null = null
let lastBeepAt = 0
let activeOscillator: OscillatorNode | null = null
let activeGain: GainNode | null = null
let activeContext: AudioContext | null = null

const getAudioContext = () => {
  if (typeof window === 'undefined') {
    return null
  }
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) {
    return null
  }
  if (!audioContext) {
    audioContext = new AudioContextCtor()
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

export const startTone = (options: BeepOptions = {}) => {
  const context = getAudioContext()
  if (!context) {
    return
  }
  if (activeOscillator && activeGain) {
    const now = context.currentTime
    activeGain.gain.cancelScheduledValues(now)
    activeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
    activeOscillator.stop(now + 0.05)
  }

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const frequency = options.frequency ?? 760
  const volume = options.volume ?? 0.06
  const now = context.currentTime

  oscillator.type = options.type ?? 'triangle'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()

  activeOscillator = oscillator
  activeGain = gain
  activeContext = context

  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
    if (activeOscillator === oscillator) {
      activeOscillator = null
      activeGain = null
      activeContext = null
    }
  }
}

export const stopTone = () => {
  if (!activeOscillator || !activeGain || !activeContext) {
    return
  }
  const oscillator = activeOscillator
  const gain = activeGain
  const context = activeContext
  const now = context.currentTime

  activeOscillator = null
  activeGain = null
  activeContext = null

  gain.gain.cancelScheduledValues(now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
  oscillator.stop(now + 0.05)
}

export const playBeep = (options: BeepOptions = {}) => {
  const nowMs = Date.now()
  if (nowMs - lastBeepAt < 40) {
    return
  }
  lastBeepAt = nowMs
  const context = getAudioContext()
  if (!context) {
    return
  }
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const frequency = options.frequency ?? 760
  const duration = (options.durationMs ?? 70) / 1000
  const volume = options.volume ?? 0.06
  const now = context.currentTime

  oscillator.type = options.type ?? 'triangle'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(now + duration + 0.02)
  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
  }
}
