import { useState, useEffect } from 'react'
import { X, Bell, Download, Share2 } from 'lucide-react'
import { subscribeToPush } from '../../lib/push'
import { useAuth } from '../../context/AuthContext'

const LS_INSTALL_DISMISSED = 'ist_install_dismissed'
const LS_NOTIF_DISMISSED = 'ist_notif_dismissed'

type ActivePrompt = 'install' | 'ios-install' | 'notification' | null

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

function shouldShowNotification() {
  return (
    'Notification' in window &&
    Notification.permission === 'default' &&
    !localStorage.getItem(LS_NOTIF_DISMISSED)
  )
}

export default function AppPrompts() {
  const { user } = useAuth()
  const [active, setActive] = useState<ActivePrompt>(null)
  const [deferredEvent, setDeferredEvent] = useState<any>(null)
  const [visible, setVisible] = useState(false)

  // Intercetta l'evento installazione prima che sparisca
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredEvent(e)
      if (!localStorage.getItem(LS_INSTALL_DISMISSED) && !isStandalone()) {
        show('install')
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Per iOS e fallback notifiche (dopo 4s dall'apertura)
  useEffect(() => {
    if (isStandalone()) return
    const t = setTimeout(() => {
      if (localStorage.getItem(LS_INSTALL_DISMISSED)) {
        if (shouldShowNotification()) show('notification')
      } else if (isIOS()) {
        show('ios-install')
      }
    }, 4000)
    return () => clearTimeout(t)
  }, [])

  function show(p: ActivePrompt) {
    setActive(p)
    requestAnimationFrame(() => setVisible(true))
  }

  function dismiss(next?: ActivePrompt) {
    setVisible(false)
    setTimeout(() => {
      setActive(next ?? null)
      if (next) requestAnimationFrame(() => setVisible(true))
    }, 320)
  }

  const dismissInstall = () => {
    localStorage.setItem(LS_INSTALL_DISMISSED, '1')
    if (shouldShowNotification()) {
      dismiss('notification')
    } else {
      dismiss()
    }
  }

  const handleInstall = async () => {
    if (deferredEvent) {
      deferredEvent.prompt()
      await deferredEvent.userChoice
      setDeferredEvent(null)
    }
    dismissInstall()
  }

  const dismissNotification = () => {
    localStorage.setItem(LS_NOTIF_DISMISSED, '1')
    dismiss()
  }

  const handleEnableNotifications = async () => {
    const permission = await Notification.requestPermission()
    if (permission === 'granted' && user?.id) {
      await subscribeToPush(user.id)
    }
    dismissNotification()
  }

  if (!active) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[95] flex justify-center px-4"
      style={{ paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom) + 80px))' }}
    >
      <div
        className="w-full rounded-[24px] overflow-hidden transition-all duration-300"
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
        {active === 'install' && (
          <InstallCard onInstall={handleInstall} onDismiss={dismissInstall} />
        )}
        {active === 'ios-install' && (
          <IOSInstallCard onDismiss={dismissInstall} />
        )}
        {active === 'notification' && (
          <NotificationCard onEnable={handleEnableNotifications} onDismiss={dismissNotification} />
        )}
      </div>
    </div>
  )
}

// ── Install (Chrome / Android) ────────────────────────────────────────────────

function InstallCard({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
        >
          <span className="text-white font-bold text-base">IST</span>
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--ist-text)' }}>
            Aggiungi IST alla home
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
            Accedi più velocemente all'app direttamente dalla schermata principale.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 -mt-1 -mr-1"
          style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDismiss}
          className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
          style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
        >
          Dopo
        </button>
        <button
          onClick={onInstall}
          className="flex-1 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #5A9AB1, #286680)',
            color: 'white',
            boxShadow: '0 4px 16px rgba(40,102,128,0.35)',
          }}
        >
          <Download size={15} strokeWidth={2} />
          Installa
        </button>
      </div>
    </div>
  )
}

// ── Install (iOS Safari — istruzioni manuali) ─────────────────────────────────

function IOSInstallCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
        >
          <span className="text-white font-bold text-base">IST</span>
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--ist-text)' }}>
            Aggiungi IST alla home
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
            Accedi all'app come un'app nativa dal tuo iPhone.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 -mt-1 -mr-1"
          style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      </div>

      {/* Steps */}
      <div
        className="rounded-2xl px-4 py-3 flex flex-col gap-2.5"
        style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w9)' }}
      >
        {[
          { n: '1', text: 'Tocca l\'icona', sub: <Share2 size={13} className="inline-block mx-0.5 -mt-0.5" /> },
          { n: '2', text: 'Scorri e seleziona "Aggiungi alla schermata Home"', sub: null },
          { n: '3', text: 'Conferma con "Aggiungi"', sub: null },
        ].map(step => (
          <div key={step.n} className="flex items-start gap-2.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(90,154,177,0.20)', color: '#7CBBD0' }}
            >
              {step.n}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
              {step.text}{step.sub}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={onDismiss}
        className="py-2.5 rounded-2xl text-sm font-medium transition-all"
        style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
      >
        Ho capito
      </button>
    </div>
  )
}

// ── Notifications ─────────────────────────────────────────────────────────────

function NotificationCard({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' }}
        >
          <Bell size={22} strokeWidth={2} style={{ color: '#7CBBD0' }} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--ist-text)' }}>
            Abilita le notifiche
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
            Ricevi aggiornamenti su nuovi messaggi, live e comunicazioni del tuo coach.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 -mt-1 -mr-1"
          style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDismiss}
          className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
          style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
        >
          Non ora
        </button>
        <button
          onClick={onEnable}
          className="flex-1 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #5A9AB1, #286680)',
            color: 'white',
            boxShadow: '0 4px 16px rgba(40,102,128,0.35)',
          }}
        >
          <Bell size={15} strokeWidth={2} />
          Abilita
        </button>
      </div>
    </div>
  )
}
