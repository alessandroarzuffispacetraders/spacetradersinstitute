import PageHeader from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'
import IncomingFlags from '../../components/ui/IncomingFlags'

export default function MentalCoachSegnalazioni() {
  const { user } = useAuth()
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Segnalazioni" subtitle="Segnalazioni ricevute dall'admin" />
      <IncomingFlags userId={user?.id ?? ''} emptyText="Nessuna segnalazione ricevuta dall'admin." />
    </div>
  )
}
