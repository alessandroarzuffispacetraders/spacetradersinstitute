import { MessageCircle, Brain, GraduationCap, Inbox } from 'lucide-react'
import UserAvatar from '../ui/UserAvatar'

export interface TeamPerson { id?: string | null; name: string | null; avatarUrl?: string | null; avatarPreset?: string | null }

function PersonCard({ role, icon: Icon, accent, glow, person, unread, subtitle, onWrite }: {
  role: string
  icon: typeof Brain
  accent: string
  glow: string
  person: TeamPerson
  unread: number
  subtitle: string
  onWrite: () => void
}) {
  const name = person.name ?? 'Da assegnare'
  return (
    <button onClick={onWrite} className="home-person group text-left w-full h-full rounded-3xl p-5 flex flex-col gap-4" style={{ ['--glow' as string]: glow }}>
      <div className="flex items-center gap-3.5">
        <span className="relative flex-shrink-0 rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.05))` }}>
          <span className="block rounded-full overflow-hidden" style={{ background: '#05070d' }}>
            <UserAvatar user={{ name, avatarUrl: person.avatarUrl ?? undefined, avatarPreset: person.avatarPreset ?? undefined }} size={54} />
          </span>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ background: '#E5484D', boxShadow: '0 0 0 2px #0a0e17' }}>{unread}</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
            <Icon size={12} strokeWidth={2.4} /> {role}
          </span>
          <span className="block text-base font-bold text-white truncate">{name}</span>
          <span className="block text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{subtitle}</span>
        </span>
      </div>
      <span className="mt-auto inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold text-white transition-colors" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <MessageCircle size={15} strokeWidth={2.2} /> {unread > 0 ? 'Leggi e rispondi' : 'Scrivi'}
      </span>
    </button>
  )
}

// "Il tuo team": coach e mental coach come schede persona (con i messaggi
// non letti), più la scheda dei messaggi privati.
export default function TeamRow({ coach, mental, coachUnread, mentalUnread, others, completedSessions, onCoach, onMental, onInbox }: {
  coach: TeamPerson
  mental: TeamPerson
  coachUnread: number
  mentalUnread: number
  others: { id: string; name: string; avatarUrl?: string; avatarPreset?: string; n: number }[]
  completedSessions: number
  onCoach: () => void
  onMental: () => void
  onInbox: () => void
}) {
  const otherTotal = others.reduce((s, o) => s + o.n, 0)
  return (
    <div className="cinema-px">
      <div className="home-team-scroll flex lg:grid lg:grid-cols-3 gap-3 lg:gap-4 overflow-x-auto no-scrollbar -mx-[var(--g-l)] px-[var(--g-l)] lg:mx-0 lg:px-0 media-scroller">
        <div className="snap-start flex-shrink-0 w-[80vw] sm:w-[46vw] lg:w-auto">
          <PersonCard role="Coach" icon={GraduationCap} accent="#7CBBD0" glow="rgba(124,187,208,0.22)" person={coach} unread={coachUnread}
            subtitle={coachUnread > 0 ? `${coachUnread} ${coachUnread === 1 ? 'messaggio nuovo' : 'messaggi nuovi'}` : 'Il tuo coach personale'} onWrite={onCoach} />
        </div>
        <div className="snap-start flex-shrink-0 w-[80vw] sm:w-[46vw] lg:w-auto">
          <PersonCard role="Mental Coach" icon={Brain} accent="#8FB3FF" glow="rgba(143,179,255,0.2)" person={mental} unread={mentalUnread}
            subtitle={mentalUnread > 0 ? `${mentalUnread} ${mentalUnread === 1 ? 'messaggio nuovo' : 'messaggi nuovi'}` : completedSessions > 0 ? `${completedSessions} ${completedSessions === 1 ? 'sessione completata' : 'sessioni completate'}` : 'Il tuo mental coach'}
            onWrite={onMental} />
        </div>
        <div className="snap-start flex-shrink-0 w-[80vw] sm:w-[46vw] lg:w-auto">
          <button onClick={onInbox} className="home-person group text-left w-full h-full rounded-3xl p-5 flex flex-col gap-4" style={{ ['--glow' as string]: 'rgba(246,200,95,0.16)' }}>
            <div className="flex items-center gap-3.5">
              <span className="w-[58px] h-[58px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(246,200,95,0.12)', border: '1px solid rgba(246,200,95,0.25)', color: '#F6C85F' }}>
                <Inbox size={22} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#F6C85F' }}>Messaggi privati</span>
                <span className="block text-base font-bold text-white">{otherTotal > 0 ? `${otherTotal} da leggere` : 'Tutto letto'}</span>
                <span className="block text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {others.length > 0 ? others.slice(0, 2).map(o => o.name.split(' ')[0]).join(', ') + (others.length > 2 ? ` e altri ${others.length - 2}` : '') : 'Nessun messaggio in attesa'}
                </span>
              </span>
            </div>
            <span className="mt-auto flex items-center gap-2">
              <span className="flex -space-x-2">
                {others.slice(0, 4).map(o => (
                  <span key={o.id} className="rounded-full" style={{ boxShadow: '0 0 0 2px #0a0e17' }}>
                    <UserAvatar user={{ name: o.name, avatarUrl: o.avatarUrl, avatarPreset: o.avatarPreset }} size={26} />
                  </span>
                ))}
              </span>
              <span className="ml-auto inline-flex items-center gap-2 py-2.5 px-4 rounded-2xl text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <MessageCircle size={15} strokeWidth={2.2} /> Apri la chat
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
