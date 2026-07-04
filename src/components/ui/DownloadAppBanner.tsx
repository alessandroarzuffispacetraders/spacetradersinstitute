import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { X, Download } from 'lucide-react'

// Invito a scaricare l'app nativa, mostrato SOLO sul sito web (mai dentro l'app
// nativa: là è già installata). Si attiva quando è configurato l'URL dello store
// (VITE_IOS_APP_URL) — così finché l'app non è pubblicata il banner non compare
// e non c'è nessun tasto "morto". Stesso pattern env di VITE_JOURNAL_URL.
const IOS_APP_URL = (import.meta.env.VITE_IOS_APP_URL as string | undefined)?.trim()
const LS_DISMISSED = 'ist_app_download_dismissed'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
}

export default function DownloadAppBanner() {
  const [active, setActive] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Solo web (non nel guscio nativo), solo iPhone, solo se c'è l'URL e non è
    // stato già chiuso.
    if (Capacitor.isNativePlatform()) return
    if (!IOS_APP_URL) return
    if (!isIOS()) return
    if (localStorage.getItem(LS_DISMISSED)) return

    const t = setTimeout(() => {
      setActive(true)
      requestAnimationFrame(() => setVisible(true))
    }, 2500)
    return () => clearTimeout(t)
  }, [])

  if (!active) return null

  const close = () => {
    setVisible(false)
    setTimeout(() => setActive(false), 320)
  }

  const dismiss = () => {
    localStorage.setItem(LS_DISMISSED, '1')
    close()
  }

  const handleDownload = () => {
    if (IOS_APP_URL) window.open(IOS_APP_URL, '_blank', 'noopener')
    dismiss()
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[96] flex justify-center px-4 pointer-events-none"
      style={{ paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom) + 80px))' }}
    >
      <div
        className="w-full rounded-[24px] overflow-hidden transition-all duration-300 pointer-events-auto"
        style={{
          maxWidth: 480,
          background: 'var(--ist-nav-bg)',
          border: '1px solid var(--ist-nav-border)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.50), 0 24px 60px rgba(0,0,0,0.40)',
          transform: visible ? 'translateY(0)' : 'translateY(32px)',
          opacity: visible ? 1 : 0,
        }}
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            {/* Icona = app icon reale → sembra la scheda dell'App Store */}
            <img
              src="/apple-touch-icon.png"
              alt="Space Traders Institute"
              className="w-12 h-12 rounded-[13px] flex-shrink-0"
              style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
            />
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--ist-text)' }}>
                Scarica l'app IST
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
                Vivi Space Traders Institute come un'app nativa: più veloce, con notifiche e messaggi vocali.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 -mt-1 -mr-1"
              style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
              aria-label="Chiudi"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
              style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
            >
              Non ora
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #5A9AB1, #286680)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(40,102,128,0.35)',
              }}
            >
              <Download size={15} strokeWidth={2} />
              Scarica
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
