import { UserRole } from '../../types'
import { useAuth } from '../../context/AuthContext'
import ISTLogo from '../../components/ui/ISTLogo'

const ROLES: {
  role: UserRole
  label: string
  tag: string
  desc: string
  gradient: string
  blob1: string
  blob2: string
}[] = [
  {
    role: 'student',
    label: 'Studente',
    tag: 'Percorso 90gg',
    desc: 'Accedi al tuo percorso di coaching e videocorsi',
    gradient: 'from-[#5A9AB1] via-[#286680] to-[#0A3346]',
    blob1: 'bg-[#7CBBD0]/50',
    blob2: 'bg-[#155A72]/70',
  },
  {
    role: 'coach',
    label: 'Coach',
    tag: 'Gestione',
    desc: 'Monitora e guida i tuoi studenti assegnati',
    gradient: 'from-[#155A72] via-[#0F455C] to-[#070812]',
    blob1: 'bg-[#5A9AB1]/40',
    blob2: 'bg-[#0A3346]/80',
  },
  {
    role: 'mental_coach',
    label: 'Mental Coach',
    tag: 'Sessioni',
    desc: 'Supporto psicologico e sessioni individuali',
    gradient: 'from-[#286680] via-[#0A3346] to-[#061D2A]',
    blob1: 'bg-[#7CBBD0]/40',
    blob2: 'bg-[#0F455C]/80',
  },
  {
    role: 'admin',
    label: 'Admin',
    tag: 'Piattaforma',
    desc: 'Gestione completa della piattaforma IST',
    gradient: 'from-[#3da67b] via-[#2a8060] to-[#0f3a28]',
    blob1: 'bg-[#5dc4a0]/50',
    blob2: 'bg-[#1a6045]/70',
  },
]

export default function LoginPage() {
  const { login } = useAuth()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'radial-gradient(circle at 20% 10%, rgba(90,154,177,0.28) 0%, transparent 34%), radial-gradient(circle at 80% 20%, rgba(40,102,128,0.22) 0%, transparent 32%), linear-gradient(135deg, #070812 0%, #0B1020 52%, #061D2A 100%)',
      }}
    >
      {/* Hero header */}
      <div className="relative overflow-hidden px-6 pt-14 pb-12 flex flex-col items-center text-center">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(90,154,177,0.20) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-8 left-1/4 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(40,102,128,0.18) 0%, transparent 65%)' }}
        />

        <div className="relative z-10 flex flex-col items-center">
          <ISTLogo size={64} showText={false} className="mb-6" />
          <p className="text-ist-300 text-xs font-semibold tracking-[0.3em] uppercase mb-1">Institute</p>
          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-1">
            Space Traders
          </h1>
          <p className="text-sm mt-3" style={{ color: '#8495A3' }}>
            Seleziona il tuo ruolo per accedere
          </p>
          <div
            className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full"
            style={{
              background: 'rgba(90,154,177,0.12)',
              border: '1px solid rgba(90,154,177,0.24)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-ist-400 animate-pulse" />
            <span className="text-xs text-ist-300 font-medium">Demo — accesso mock</span>
          </div>
        </div>
      </div>

      {/* Role cards */}
      <div className="flex-1 px-5 pb-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
        {ROLES.map(({ role, label, tag, desc, gradient, blob1, blob2 }) => (
          <button
            key={role}
            data-inverted="true"
            onClick={() => login(role)}
            className="group relative overflow-hidden rounded-4xl text-left cursor-pointer active:scale-[0.97] transition-transform duration-150"
            style={{ minHeight: 160 }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
            <div className={`absolute -top-8 -right-8 w-36 h-36 rounded-full ${blob1} blur-sm`} />
            <div className={`absolute -bottom-12 -left-6 w-52 h-52 rounded-full ${blob2}`} />

            <div
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors"
              style={{ background: 'var(--ist-w14)', backdropFilter: 'blur(8px)' }}
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 17L17 7M7 7h10v10" />
              </svg>
            </div>

            <div className="relative z-10 p-5 flex flex-col h-full justify-between">
              <div>
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-white/90 text-xs font-semibold mb-3"
                  style={{ background: 'var(--ist-w16)' }}
                >
                  {tag}
                </span>
                <h2 className="text-xl font-bold text-white leading-tight">{label}</h2>
                <p className="text-sm text-white/60 mt-1 leading-snug">{desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-center text-xs pb-8" style={{ color: '#56636F' }}>
        © 2024 IST — Space Traders Institute
      </p>
    </div>
  )
}
