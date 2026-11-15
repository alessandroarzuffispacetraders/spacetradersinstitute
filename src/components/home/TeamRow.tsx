import { MessageCircle, Brain, GraduationCap, Inbox, ChevronRight } from 'lucide-react'
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
    <button onClick={onWrite} className="home-person group text-left w-full rounded-3xl p-4 flex items-center gap-3.5" style={{ ['--glow' as string]: glow }}>
      <span className="relative flex-shrink-0 rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.05))` }}>
        <span className="block rounded-full overflow-hidden" style={{ background: '#05070d' }}>
          <UserAvatar user={{ name, avatarUrl: person.avatarUrl ?? undefined, avatarPreset: person.avatarPreset ?? undefined }} size={48} />
        </span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ background: '#E5484D', boxShadow: '0 0 0 2px #0a0e17' }}>{unread}</span>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
          <Icon size={12} strokeWidth={2.4} /> {role}
        </span>
        <span className="block text-[15px] font-bold text-white truncate">{name}</span>
        <span className="block text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{subtitle}</span>
      </span>
      <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-colors group-hover:bg-white/15" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }} aria-hidden>
        <MessageCircle size={17} strokeWidth={2.2} />
      </span>
    </button>
  )
}

// "Il tuo team": coach e mental coach, uno accanto all'altro.
export default function TeamRow({ coach, mental, coachUnread, mentalUnread, completedSessions, onCoach, onMental }: {
  coach: TeamPerson
  mental: TeamPerson
  coachUnread: number
  mentalUnread: number
  completedSessions: number
  onCoach: () => void
  onMental: () => void
}) {
  const news = (n: number) => `${n} ${n === 1 ? 'messaggio nuovo' : 'messaggi nuovi'}`
  return (
    <div className="cinema-px grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
      <PersonCard role="Coach" icon={GraduationCap} accent="#7CBBD0" glow="rgba(124,187,208,0.22)" person={coach} unread={coachUnread}
        subtitle={coachUnread > 0 ? news(coachUnread) : 'Il tuo coach personale'} onWrite={onCoach} />
      <PersonCard role="Mental Coach" icon={Brain} accent="#8FB3FF" glow="rgba(143,179,255,0.2)" person={mental} unread={mentalUnread}
        subtitle={mentalUnread > 0 ? news(mentalUnread) : completedSessions > 0 ? `${completedSessions} ${completedSessions === 1 ? 'sessione completata' : 'sessioni completate'}` : 'Il tuo mental coach'}
        onWrite={onMental} />
    </div>
  )
}

// Messaggi privati: striscia compatta (diversa dalle schede del team), con chi
// ha scritto e quanti messaggi aspettano.
export function MessagesStrip({ others, onOpen }: {
  others: { id: string; name: string; avatarUrl?: string; avatarPreset?: string; n: number }[]
  onOpen: () => void
}) {
  const total = others.reduce((s, o) => s + o.n, 0)
  const who = others.slice(0, 2).map(o => o.name.split(' ')[0]).join(', ') + (others.length > 2 ? ` e altri ${others.length - 2}` : '')
  return (
    <div className="cinema-px">
      <button onClick={onOpen} className={`home-inbox group w-full text-left rounded-2xl pl-4 pr-3 py-3 flex items-center gap-3 ${total > 0 ? 'has-news' : ''}`}>
        <span className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: total > 0 ? 'rgba(246,200,95,0.16)' : 'rgba(255,255,255,0.06)', color: total > 0 ? '#F6C85F' : 'rgba(255,255,255,0.55)' }}>
          <Inbox size={17} strokeWidth={2.1} />
          {total > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: '#E5484D', boxShadow: '0 0 0 2px #0a0e17' }} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-white">
            Messaggi privati{total > 0 && <span style={{ color: '#F6C85F' }}> · {total} da leggere</span>}
          </span>
          <span className="block text-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{total > 0 ? `Da ${who}` : 'Nessun messaggio in attesa'}</span>
        </span>
        {others.length > 0 && (
          <span className="hidden sm:flex -space-x-2 flex-shrink-0">
            {others.slice(0, 4).map(o => (
              <span key={o.id} className="rounded-full" style={{ boxShadow: '0 0 0 2px #0a0e17' }}>
                <UserAvatar user={{ name: o.name, avatarUrl: o.avatarUrl, avatarPreset: o.avatarPreset }} size={26} />
              </span>
            ))}
          </span>
        )}
        <ChevronRight size={18} strokeWidth={2.2} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'rgba(255,255,255,0.45)' }} />
      </button>
    </div>
  )
}
