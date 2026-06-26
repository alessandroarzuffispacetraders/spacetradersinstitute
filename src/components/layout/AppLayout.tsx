import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { UIProvider, useUI } from '../../context/UIContext'
import ProfileModal from '../ui/ProfileModal'
import AppPrompts from '../ui/AppPrompts'

function AppShell() {
  const { profileOpen, setProfileOpen } = useUI()
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="ist-page lg:pl-[108px] pb-28 lg:pb-0 min-h-screen">
        <Outlet />
      </main>
      <BottomNav />
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <AppPrompts />
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
