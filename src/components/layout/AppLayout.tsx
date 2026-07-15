import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { UIProvider, useUI, hasStoredNavMode } from '../../context/UIContext'
import { NewsProvider } from '../../context/NewsContext'
import ProfileModal from '../ui/ProfileModal'
import AppPrompts from '../ui/AppPrompts'
import AppDownloadPrompt from '../ui/AppDownloadPrompt'
import { useAuth } from '../../context/AuthContext'
import { hasManagement, normalizeRoles } from '../../router/navConfig'
import { supabase } from '../../lib/supabase'
import { isViewingChannel } from '../../lib/activeChat'
import { isNativeApp } from '../../lib/nativeUi'
import { ensureNativePushReady, claimNativePush } from '../../lib/nativePush'

// Ponte tra il service worker e il router: quando si clicca una notifica push
// mentre l'app è già aperta, il SW invia { type:'ist-navigate', url } e qui
// navighiamo in-app (soft, senza reload).
function PushNavigationBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'ist-navigate' && typeof data.url === 'string') {
        navigate(data.url)
      }
      // Il SW chiede se stai già guardando quel canale (per non mostrare la push).
      if (data?.type === 'ist-viewing?' && event.ports[0]) {
        event.ports[0].postMessage({ viewing: isViewingChannel(data.channelId) })
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)

    // Chiede al SW un'eventuale destinazione in sospeso dopo il click su una
    // notifica (necessario su iOS/PWA, dove il postMessage/openWindow può
    // perdersi): al mount e ogni volta che l'app torna in primo piano.
    const askPending = () => {
      navigator.serviceWorker.ready
        .then(reg => (reg.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'ist-get-pending' }))
        .catch(() => {/* noop */})
    }
    askPending()
    const onVisible = () => { if (document.visibilityState === 'visible') askPending() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handler)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [navigate])

  return null
}

// Push NATIVE (APNs): registra il device token per l'utente loggato e, al tap su
// una notifica, naviga al deep-link in-app. No-op sul web (là valgono Web Push +
// SW gestiti da PushNavigationBridge/NotificationManager).
function NativePushBridge() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!isNativeApp() || !user) return
    let cancelled = false
    ;(async () => {
      await ensureNativePushReady((url) => navigate(url))
      if (!cancelled) await claimNativePush()
    })()
    return () => { cancelled = true }
  }, [user?.id, navigate])

  return null
}

// Ascolta tutti i nuovi messaggi e mostra notifiche browser per quelli altrui
function NotificationManager() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    if (localStorage.getItem('ist_notif_enabled') === 'false') return

    const sub = supabase
      .channel('notif:all-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as {
            user_id: string
            author_name: string
            content: string
            channel_id: string
          }
          if (msg.user_id === user.id) return
          if (localStorage.getItem('ist_notif_enabled') === 'false') return
          // Sei già dentro (e vedi) quella chat → niente notifica.
          if (isViewingChannel(msg.channel_id)) return

          try {
            const n = new Notification(msg.author_name, {
              body: msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: msg.channel_id,
            })
            // Click → porta direttamente alla chat interessata (canale o DM).
            n.onclick = () => {
              window.focus()
              navigate(`/student/chat?c=${encodeURIComponent(msg.channel_id)}`)
              n.close()
            }
          } catch {
            // Notification non supportata o bloccata silenziosamente
          }
        }
      )
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [user?.id, navigate])

  return null
}

function AppShell() {
  const { profileOpen, setProfileOpen, setNavMode } = useUI()
  const { user } = useAuth()

  // Default modalità: lo staff (chi ha un ruolo gestionale) parte in "Gestisci"
  // al primo accesso; poi rispetta la scelta manuale memorizzata.
  useEffect(() => {
    if (!user || hasStoredNavMode()) return
    const roles = normalizeRoles(user.role, user.roles)
    if (hasManagement(roles)) setNavMode('manage')
  }, [user?.id])

  return (
    <NewsProvider>
      <div className="app-shell" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <Sidebar />
        <main className="ist-page lg:pl-[108px] pb-28 lg:pb-0 min-h-screen">
          <Outlet />
        </main>
        <BottomNav />
        <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
        {/* Banner "Aggiungi alla home" + richiesta notifiche + invito a scaricare
            l'app nativa: solo sul web. Nell'app nativa non servono → nascosti. */}
        {!Capacitor.isNativePlatform() && <AppPrompts />}
        {!Capacitor.isNativePlatform() && <AppDownloadPrompt />}
        <NotificationManager />
        <PushNavigationBridge />
        <NativePushBridge />
      </div>
    </NewsProvider>
  )
}

export default function AppLayout() {
  return (
    <UIProvider>
      <AppShell />
    </UIProvider>
  )
}
