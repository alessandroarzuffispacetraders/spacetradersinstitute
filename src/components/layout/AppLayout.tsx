import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { UIProvider, useUI } from '../../context/UIContext'
import ProfileModal from '../ui/ProfileModal'
import AppPrompts from '../ui/AppPrompts'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// Ascolta tutti i nuovi messaggi e mostra notifiche browser per quelli altrui
function NotificationManager() {
  const { user } = useAuth()

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

          try {
            new Notification(msg.author_name, {
              body: msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content,
              icon: '/icon.svg',
              badge: '/icon.svg',
              tag: msg.channel_id,
            })
          } catch {
            // Notification non supportata o bloccata silenziosamente
          }
        }
      )
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [user?.id])

  return null
}

function AppShell() {
  const { profileOpen, setProfileOpen } = useUI()
  return (
    <div className="app-shell" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <Sidebar />
      <main className="ist-page lg:pl-[108px] pb-28 lg:pb-0 min-h-screen">
        <Outlet />
      </main>
      <BottomNav />
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <AppPrompts />
      <NotificationManager />
    </div>
  )
}

export default function AppLayout() {
  return (
    <UIProvider>
      <AppShell />
    </UIProvider>
  )
}
