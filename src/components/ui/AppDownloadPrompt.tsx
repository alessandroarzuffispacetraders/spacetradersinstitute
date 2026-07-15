import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { X, Download, Smartphone } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

// Invito a scaricare l'app nativa — mostrato SOLO sul sito web (mai dentro l'app
// nativa: là è già installata). Al primo ingresso apre un popup una-tantum
// (a tutto schermo su smartphone, modale centrato su desktop); poi resta un
// tasto sempre visibile per riaprirlo. Su desktop il popup mostra un QR da
// inquadrare col telefono; su smartphone il tasto porta direttamente allo store.
//
// URL store: usa VITE_IOS_APP_URL se è un link reale, altrimenti il link App
// Store noto (così funziona in produzione anche senza env impostata). L'Android
// verrà aggiunto quando sarà pubblica.
const REAL_APP_STORE_URL = 'https://apps.apple.com/it/app/space-traders-institute/id6787509791'
const CONFIGURED = (import.meta.env.VITE_IOS_APP_URL as string | undefined)?.trim()
const APP_STORE_URL = CONFIGURED && !/id0+$/.test(CONFIGURED) ? CONFIGURED : REAL_APP_STORE_URL

const LS_SEEN = 'ist_app_promo_seen'

// Per ora esiste solo l'app iOS. Su un browser Android mobile non ha senso
// spingere un link App Store: nascondiamo finché l'app Android non è pubblica
// (allora si aggiunge il link Play Store e si mostra anche lì). iOS mobile e
// desktop (QR da inquadrare con l'iPhone) restano i target utili.
function isAndroidMobileWeb() {
  return /android/i.test(navigator.userAgent)
}

export default function AppDownloadPrompt() {
  const [open, setOpen] = useState(false)

  const hidden = Capacitor.isNativePlatform() || isAndroidMobileWeb()

  // Apertura automatica una-tantum al primo ingresso; poi solo il tasto.
  useEffect(() => {
    if (hidden) return
    if (localStorage.getItem(LS_SEEN)) return
    const t = setTimeout(() => setOpen(true), 1500)
    return () => clearTimeout(t)
  }, [hidden])

  // Dentro l'app nativa (o su Android web, per ora) non deve comparire nulla.
  if (hidden) return null

  const markSeen = () => { try { localStorage.setItem(LS_SEEN, '1') } catch { /* storage non disponibile */ } }
  const dismiss = () => { markSeen(); setOpen(false) }
  const openStore = () => { window.open(APP_STORE_URL, '_blank', 'noopener'); markSeen() }

  return (
    <>
      {/* Tasto sempre visibile (web). Su mobile sta sopra la bottom nav. */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-28 lg:bottom-6 z-[95] flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-[0.97]"
        style={{
          background: 'linear-gradient(135deg, #5A9AB1, #286680)',
          color: '#fff',
          boxShadow: '0 6px 24px rgba(40,102,128,0.45)',
        }}
        aria-label="Scarica l'app"
      >
        <Smartphone size={16} strokeWidth={2} />
        Scarica l'app
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-stretch lg:items-center justify-center lg:p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={dismiss}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full lg:max-w-md flex flex-col justify-center gap-6 p-8 lg:rounded-3xl overflow-y-auto"
            style={{
              background: 'var(--ist-card-bg)',
              border: '1px solid var(--ist-border)',
              boxShadow: 'var(--ist-card-shadow-premium)',
              paddingTop: 'max(2rem, env(safe-area-inset-top))',
              paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
            }}
          >
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
              aria-label="Chiudi"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            <div className="flex flex-col items-center text-center gap-3">
              <img
                src="/apple-touch-icon.png"
                alt="Space Traders Institute"
                className="w-20 h-20 rounded-[22px]"
                style={{ boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}
              />
              <h2 className="text-xl font-bold" style={{ color: 'var(--ist-text)' }}>
                Scarica l'app IST
              </h2>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--ist-text-muted)' }}>
                Vivi Space Traders Institute come un'app nativa: più veloce, con notifiche push e messaggi vocali.
              </p>
            </div>

            {/* QR — utile da desktop: si inquadra col telefono. Nascosto su mobile,
                dove il tasto porta direttamente allo store. */}
            <div className="hidden lg:flex flex-col items-center gap-2">
              <div className="p-3 rounded-2xl bg-white">
                <QRCodeSVG value={APP_STORE_URL} size={168} bgColor="#ffffff" fgColor="#0B1020" level="M" />
              </div>
              <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>
                Inquadra il QR con la fotocamera del telefono
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={openStore}
                className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', boxShadow: '0 4px 20px rgba(40,102,128,0.4)' }}
              >
                <Download size={17} strokeWidth={2} />
                Scarica su App Store
              </button>
              <button
                onClick={dismiss}
                className="w-full py-2.5 rounded-2xl text-sm font-medium"
                style={{ color: 'var(--ist-text-muted)' }}
              >
                Non ora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
