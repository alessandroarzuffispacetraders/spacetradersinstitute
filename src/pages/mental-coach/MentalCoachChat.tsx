import { useState } from 'react'
import { Send } from 'lucide-react'

const STUDENTS = [
  { id: 1, name: 'Marco Rossi',    lastMsg: 'Grazie per i consigli sulla meditazione!',         time: '2h fa',      unread: 1 },
  { id: 2, name: 'Anna Pellegrini',lastMsg: 'Ok perfetto, ci sentiamo mercoledì',               time: 'Ieri',       unread: 0 },
  { id: 3, name: 'Luca Ferrari',   lastMsg: "Ho provato l'esercizio che mi hai assegnato...",  time: '3 giorni fa', unread: 0 },
]

const MOCK_MESSAGES: Record<number, { author: string; text: string; time: string; own?: boolean }[]> = {
  1: [
    { author: 'Marco Rossi', text: 'Ho fatto gli esercizi di journaling questa settimana come avevamo concordato', time: '10:15' },
    { author: 'Sofia',       text: "Ottimo Marco! Come ti sei sentito durante l'esercizio?", time: '10:30', own: true },
    { author: 'Marco Rossi', text: "All'inizio strano, ma poi ho capito quante cose mi passano per la testa durante il trading", time: '10:35' },
    { author: 'Sofia',       text: 'È esattamente quello che speravo sentire 😊 Continua così!', time: '10:40', own: true },
    { author: 'Marco Rossi', text: 'Grazie per i consigli sulla meditazione!', time: '11:00' },
  ],
  2: [
    { author: 'Sofia',          text: "Ciao Anna, confermato l'appuntamento per mercoledì?", time: 'Ieri', own: true },
    { author: 'Anna Pellegrini',text: 'Ok perfetto, ci sentiamo mercoledì', time: 'Ieri' },
  ],
  3: [
    { author: 'Luca Ferrari', text: "Ho provato l'esercizio che mi hai assegnato...", time: '3 giorni fa' },
    { author: 'Sofia',        text: 'Come è andata?', time: '3 giorni fa', own: true },
  ],
}

export default function MentalCoachChat() {
  const [activeStudent, setActiveStudent] = useState<number>(1)
  const [input, setInput] = useState('')
  const messages = MOCK_MESSAGES[activeStudent] ?? []
  const student  = STUDENTS.find(s => s.id === activeStudent)

  const send = () => {
    if (!input.trim()) return
    setInput('')
  }

  return (
    <div
      className="flex fixed inset-0 z-10"
      style={{ background: 'var(--ist-nav-bg)' }}
    >
      {/* Student list sidebar */}
      <div
        className="w-52 lg:w-[240px] lg:ml-[108px] flex-shrink-0 flex flex-col"
        style={{
          borderRight: '1px solid var(--ist-w8)',
        }}
      >
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>Chat private</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2 no-scrollbar">
          {STUDENTS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveStudent(s.id)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left transition-all"
              style={activeStudent === s.id
                ? { background: 'var(--ist-nav-active-bg)' }
                : {}
              }
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  background: 'rgba(90,154,177,0.16)',
                  color: 'var(--ist-accent-text)',
                  border: '1px solid rgba(90,154,177,0.20)',
                }}
              >
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: activeStudent === s.id ? 'var(--ist-accent-text)' : 'var(--ist-text)' }}
                >
                  {s.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--ist-text-dim)' }}>
                  {s.lastMsg}
                </p>
              </div>
              {s.unread > 0 && (
                <span
                  className="w-5 h-5 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
                >
                  {s.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div
          className="px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--ist-w8)' }}
        >
          <p className="font-semibold text-sm" style={{ color: 'var(--ist-text)' }}>
            {student?.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ist-text-dim)' }}>Chat privata</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.own ? 'flex-row-reverse' : ''}`}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold"
                style={msg.own
                  ? { background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white' }
                  : { background: 'var(--ist-w8)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-border)' }
                }
              >
                {msg.author.charAt(0)}
              </div>
              <div className={`max-w-[70%] flex flex-col gap-1 ${msg.own ? 'items-end' : 'items-start'}`}>
                {!msg.own && (
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--ist-text)' }}>
                    {msg.author}
                  </span>
                )}
                <div
                  className="px-4 py-2.5 rounded-2xl text-sm"
                  style={msg.own ? {
                    background: 'var(--ist-bubble-own-bg)',
                    color: 'var(--ist-bubble-own-text)',
                    border: '1px solid var(--ist-bubble-own-border)',
                    borderTopRightRadius: 4,
                  } : {
                    background: 'var(--ist-bubble-other-bg)',
                    color: 'var(--ist-text)',
                    border: '1px solid var(--ist-bubble-other-border)',
                    borderTopLeftRadius: 4,
                  }}
                >
                  {msg.text}
                </div>
                <span className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>{msg.time}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div
          className="flex items-center gap-3 p-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--ist-w8)' }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            placeholder="Scrivi un messaggio..."
            className="flex-1 px-4 py-2.5 text-sm focus:outline-none"
            style={{
              background: 'var(--ist-input-surface)',
              border: '1px solid var(--ist-input-border)',
              borderRadius: 16,
              color: 'var(--ist-text)',
            }}
          />
          <button
            onClick={send}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:-translate-y-0.5 disabled:opacity-40"
            disabled={!input.trim()}
            style={{
              background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
              boxShadow: input.trim() ? '0 4px 16px rgba(40,102,128,0.36)' : 'none',
            }}
          >
            <Send size={16} strokeWidth={2} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
