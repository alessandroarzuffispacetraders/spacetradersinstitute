import PageHeader from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { useLiveAdmin } from '../../lib/live'
import LiveManager from '../../components/live/LiveManager'

export default function MentalCoachLive() {
  const { user } = useAuth()
  const api = useLiveAdmin({ ownerId: user?.id, onlyOwn: true })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Le mie Live" subtitle="Crea, vai in onda, termina e salva il replay" />
      <LiveManager api={api} defaultHost={user?.name} />
    </div>
  )
}
