import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

type NfceQrScannerProps = {
  onScan: (value: string) => void
  onError?: (message: string) => void
  successLabel?: string
}

const NfceQrScanner = ({ onScan, onError, successLabel }: NfceQrScannerProps) => {
  const containerIdRef = useRef(`nfce-qr-${Math.random().toString(36).slice(2)}`)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [status, setStatus] = useState('Abrindo camera...')
  const scannedRef = useRef(false)

  useEffect(() => {
    const elementId = containerIdRef.current
    if (typeof document === 'undefined') {
      return
    }
    if (!document.getElementById(elementId)) {
      setStatus('Nao foi possivel iniciar o scanner.')
      onError?.('Nao foi possivel iniciar o scanner.')
      return
    }
    let scanner: Html5Qrcode
    try {
      scanner = new Html5Qrcode(elementId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao iniciar o scanner.'
      setStatus(message)
      onError?.(message)
      return
    }
    scannerRef.current = scanner

    const safeStop = (instance: Html5Qrcode) => {
      try {
        const result = instance.stop()
        if (result && typeof (result as Promise<void>).catch === 'function') {
          ;(result as Promise<void>).catch(() => undefined)
        }
      } catch {
        // ignore stop errors when not running
      }
    }

    const start = async () => {

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            if (scannedRef.current) {
              return
            }
            scannedRef.current = true
            setStatus(successLabel ?? 'QR Code lido. Importando...')
            onScan(decodedText)
            const instance = scannerRef.current
            if (instance) {
              safeStop(instance)
            }
          },
          () => {
            // ignore scan errors to keep camera active
          },
        )
        setStatus('Aponte a camera para o QR Code da NFC-e.')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao abrir a camera.'
        setStatus(message)
        onError?.(message)
      }
    }

    void start()

    return () => {
      const instance = scannerRef.current
      if (instance) {
        const stopResult = (() => {
          try {
            return instance.stop()
          } catch {
            return null
          }
        })()
        if (stopResult && typeof (stopResult as Promise<void>).finally === 'function') {
          ;(stopResult as Promise<void>).finally(() => {
            try {
              instance.clear()
            } catch {
              // ignore cleanup errors
            }
            scannerRef.current = null
          })
        } else {
          try {
            instance.clear()
          } catch {
            // ignore cleanup errors
          }
          scannerRef.current = null
        }
      }
    }
  }, [onError, onScan, successLabel])

  return (
    <div className="nfce-qr">
      <div id={containerIdRef.current} className="nfce-qr__preview" />
      <p className="nfce-qr__status">{status}</p>
    </div>
  )
}

export default NfceQrScanner
