import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

type NfceQrScannerProps = {
  onScan: (value: string) => void
  onError?: (message: string) => void
}

const NfceQrScanner = ({ onScan, onError }: NfceQrScannerProps) => {
  const containerIdRef = useRef(`nfce-qr-${Math.random().toString(36).slice(2)}`)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [status, setStatus] = useState('Abrindo camera...')
  const scannedRef = useRef(false)

  useEffect(() => {
    const elementId = containerIdRef.current
    const scanner = new Html5Qrcode(elementId)
    scannerRef.current = scanner

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
            setStatus('QR Code lido. Importando...')
            onScan(decodedText)
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
        instance
          .stop()
          .catch(() => undefined)
          .finally(() => {
            instance.clear()
            scannerRef.current = null
          })
      }
    }
  }, [onError, onScan])

  return (
    <div className="nfce-qr">
      <div id={containerIdRef.current} className="nfce-qr__preview" />
      <p className="nfce-qr__status">{status}</p>
    </div>
  )
}

export default NfceQrScanner
