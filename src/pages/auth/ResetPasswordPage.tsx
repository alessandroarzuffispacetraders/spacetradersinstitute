import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import ISTLogo from '../../components/ui/ISTLogo'

// Schermata aperta dal link "password dimenticata" ricevuto via email.
// Il link ha già creato una sessione di recupero: qui si imposta solo la nuova
// password. Se il link è scaduto/già usato non c'è sessione → si può chiedere
// un nuovo link direttamente da qui.
type View = 'checking' | 'form' | 'invalid' | 'sent' | 'done'

const btnStyle = {
  background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
  boxShadow: '0 4px 24px rgba(90,154,177,0.3)',
}
const inputStyle = { background: 'var(--ist-w8)', border: '1px solid var(--ist-border)' }

export default function ResetPasswordPage() {
  const { recoveryActive, recoveryError, completePasswordReset, requestPasswordReset, cancelPasswordReset } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState<View>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [kbFocus, setKbFocus] = useState(false)

  // Il form si mostra solo se: (1) c'è una sessione (il link l'ha creata) E
  // (2) siamo in un recupero GENUINO (recoveryActive, da token/PASSWORD_RECOVERY,
  // durevole al reload). Così una sessione normale o un URL d'errore fabbricato
  // NON abilitano il cambio password senza la password attuale.
  // getSession() attende l'init del client (che consuma i token dall'URL), quindi
  // qui la risposta è definitiva: niente race con detectSessionInUrl.
  useEffect(() => {
    let alive = true
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!alive) return
        // Email nota dalla sessione: la usiamo per il campo "username" nascosto
        // (aiuta i gestori di password ad associare/salvare la voce giusta).
        if (session?.user?.email) setEmail(session.user.email)
        // Le schermate finali non vanno mai sovrascritte: dopo un reset riuscito
        // `recoveryActive` torna false e l'effetto rigira — senza la guardia
        // riporterebbe l'utente su "link non valido".
        setView(prev => (prev === 'done' || prev === 'sent' ? prev : session && recoveryActive ? 'form' : 'invalid'))
      })
      // getSession() può rifiutare su mobile (storage/lock in webview): non
      // lasciare mai lo spinner appeso — cadi su "link non valido" così l'utente
      // può richiedere un nuovo link invece di restare bloccato su 'checking'.
      .catch(() => {
        if (!alive) return
        setView(prev => (prev === 'done' || prev === 'sent' ? prev : 'invalid'))
      })
    return () => { alive = false }
  }, [recoveryActive])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('La password deve essere di almeno 8 caratteri'); return }
    if (password !== confirm) { setError('Le password non coincidono'); return }
    setLoading(true)
    const { error } = await completePasswordReset(password)
    setLoading(false)
    if (error) { setError(error); return }
    setView('done')
  }

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await requestPasswordReset(email)
    setLoading(false)
    if (error) { setError(error); return }
    setView('sent')
  }

  const backToLogin = async () => {
    // Chiude l'eventuale sessione di recupero rimasta aperta.
    await cancelPasswordReset()
    navigate('/login', { replace: true })
  }

  return (
    <div
      data-inverted="true"
      className={`min-h-screen flex flex-col items-center px-6 overflow-y-auto transition-all duration-200 ${kbFocus ? 'justify-start pt-8 pb-8 lg:justify-center lg:pt-0' : 'justify-center'}`}
      style={{
        background: 'radial-gradient(circle at 20% 10%, rgba(90,154,177,0.28) 0%, transparent 34%), radial-gradient(circle at 80% 20%, rgba(40,102,128,0.22) 0%, transparent 32%), linear-gradient(135deg, #070812 0%, #0B1020 52%, #061D2A 100%)',
      }}
    >
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <ISTLogo size={56} showText={false} className="mb-6" />

        {view === 'checking' && (
          <div className="w-8 h-8 mt-6 rounded-full border-2 border-ist-400 border-t-transparent animate-spin" />
        )}

        {view === 'form' && (
          <>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">Nuova password</h1>
            <p className="text-sm text-center mb-8" style={{ color: 'rgba(247,250,252,0.6)' }}>
              Scegli una nuova password per il tuo account.
            </p>

            <form
              onSubmit={handleSetPassword}
              onFocus={() => setKbFocus(true)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setKbFocus(false) }}
              className="w-full flex flex-col gap-4"
            >
              {/* Campo username (fuori schermo ma nel DOM): consente ai gestori di
                  password — iCloud Keychain, Chrome — di associare/aggiornare la
                  voce corretta dell'account durante il reset. */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={email}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Nuova password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Almeno 8 caratteri"
                    className="w-full px-4 py-3 pr-11 rounded-2xl text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-ist-400/50 transition-all"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'Nascondi password' : 'Mostra password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
                    style={{ color: 'rgba(247,250,252,0.55)' }}
                  >
                    {showPw ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Conferma password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Ripeti la password"
                  className="w-full px-4 py-3 rounded-2xl text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-ist-400/50 transition-all"
                  style={inputStyle}
                />
              </div>

              {error && <p className="text-sm text-red-400 text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                style={btnStyle}
              >
                {loading ? 'Salvataggio...' : 'Salva nuova password'}
              </button>

              <button
                type="button"
                onClick={backToLogin}
                className="text-center text-xs transition-opacity hover:opacity-80"
                style={{ color: 'rgba(247,250,252,0.55)' }}
              >
                Annulla e torna al login
              </button>
            </form>
          </>
        )}

        {view === 'invalid' && (
          <>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2 text-center">Link non valido</h1>
            <p className="text-sm text-center mb-8" style={{ color: 'rgba(247,250,252,0.6)' }}>
              {recoveryError ?? 'Il link di recupero è scaduto o è già stato usato. Inserisci la tua email per riceverne uno nuovo.'}
            </p>

            <form
              onSubmit={handleRequestLink}
              onFocus={() => setKbFocus(true)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setKbFocus(false) }}
              className="w-full flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="la-tua@email.com"
                  className="w-full px-4 py-3 rounded-2xl text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-ist-400/50 transition-all"
                  style={inputStyle}
                />
              </div>

              {error && <p className="text-sm text-red-400 text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                style={btnStyle}
              >
                {loading ? 'Invio in corso...' : 'Inviami un nuovo link'}
              </button>

              <button
                type="button"
                onClick={backToLogin}
                className="text-center text-xs transition-opacity hover:opacity-80"
                style={{ color: 'rgba(247,250,252,0.55)' }}
              >
                Torna al login
              </button>
            </form>
          </>
        )}

        {view === 'sent' && (
          <div className="w-full text-center flex flex-col items-center gap-4">
            <p className="text-white font-semibold text-lg">Controlla la tua email</p>
            <p className="text-sm" style={{ color: 'rgba(247,250,252,0.6)' }}>
              Se esiste un account associato a <strong className="text-white">{email}</strong>, riceverai un link per
              reimpostare la password. Controlla anche lo spam.
            </p>
            <button
              onClick={backToLogin}
              className="mt-2 w-full py-3.5 rounded-2xl font-semibold text-white transition-all active:scale-[0.98]"
              style={btnStyle}
            >
              Torna al login
            </button>
          </div>
        )}

        {view === 'done' && (
          <div className="w-full text-center flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(90,154,177,0.15)', border: '1px solid rgba(90,154,177,0.3)' }}
            >
              <svg className="w-7 h-7 text-ist-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg">Password aggiornata</p>
            <p className="text-sm" style={{ color: 'rgba(247,250,252,0.6)' }}>
              Da ora accedi con la nuova password.
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-2 w-full py-3.5 rounded-2xl font-semibold text-white transition-all active:scale-[0.98]"
              style={btnStyle}
            >
              Entra nell'app
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
