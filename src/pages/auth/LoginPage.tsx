import { useState } from 'react'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ISTLogo from '../../components/ui/ISTLogo'
import { upsellSuppressed } from '../../lib/freeTier'

type Mode = 'login' | 'signup' | 'signup-done' | 'forgot' | 'forgot-done'

export default function LoginPage() {
  const { login, signup, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Mobile: quando un campo è a fuoco (tastiera aperta) ancoriamo il contenuto in
  // alto, così i campi non finiscono sotto la tastiera. Su desktop resta centrato.
  const [kbFocus, setKbFocus] = useState(false)
  // iOS = app "companion" per gli iscritti al coaching 1:1 (App Review 3.1.1):
  // niente registrazione/prova gratuita in-app, solo login. Web e Android invariati.
  const allowSignup = !upsellSuppressed()

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setName('')
    // Passando da/verso "password dimenticata" l'email digitata si tiene:
    // è la stessa che serve, riscriverla sarebbe solo un fastidio.
    if (next !== 'forgot' && mode !== 'forgot') setEmail('')
    setPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'forgot') {
      const { error } = await requestPasswordReset(email)
      // La risposta è neutra anche se l'email non esiste (Supabase non rivela
      // quali indirizzi sono registrati): mostriamo sempre la stessa conferma.
      if (error) setError(error)
      else setMode('forgot-done')
    } else if (mode === 'login') {
      const { error } = await login(email, password)
      if (error) setError('Email o password non corretti')
    } else {
      if (password.length < 6) {
        setError('La password deve essere di almeno 6 caratteri')
        setLoading(false)
        return
      }
      const { error } = await signup(email, password, name)
      if (error) setError('Registrazione non riuscita. Riprova.')
      else setMode('signup-done')
    }

    setLoading(false)
  }

  return (
    <div
      data-inverted="true"
      className={`min-h-screen flex flex-col items-center px-6 overflow-y-auto transition-all duration-200 ${kbFocus ? 'justify-start pt-8 pb-8 lg:justify-center lg:pt-0' : 'justify-center'}`}
      style={{
        background: 'radial-gradient(circle at 20% 10%, rgba(90,154,177,0.28) 0%, transparent 34%), radial-gradient(circle at 80% 20%, rgba(40,102,128,0.22) 0%, transparent 32%), linear-gradient(135deg, #070812 0%, #0B1020 52%, #061D2A 100%)',
      }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(90,154,177,0.20) 0%, transparent 65%)' }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Logo */}
        <ISTLogo size={64} showText={false} className="mb-6" />
        <p className="text-ist-300 text-xs font-semibold tracking-[0.3em] uppercase mb-1">Institute</p>
        <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-1">
          Space Traders
        </h1>

        {mode === 'signup-done' || mode === 'forgot-done' ? (
          <div className="mt-10 w-full text-center flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(90,154,177,0.15)', border: '1px solid rgba(90,154,177,0.3)' }}
            >
              {mode === 'forgot-done' ? (
                <Mail className="text-ist-300" size={26} strokeWidth={2} />
              ) : (
                <svg className="w-7 h-7 text-ist-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {mode === 'forgot-done' ? (
              <>
                <p className="text-white font-semibold text-lg">Controlla la tua email</p>
                <p className="text-sm" style={{ color: '#8495A3' }}>
                  Se esiste un account associato a <strong style={{ color: '#F7FAFC' }}>{email}</strong>, riceverai un
                  link per reimpostare la password. Controlla anche lo spam.
                </p>
              </>
            ) : (
              <>
                <p className="text-white font-semibold text-lg">Registrazione completata!</p>
                <p className="text-sm" style={{ color: '#8495A3' }}>
                  Conferma la tua email, poi accedi: la <strong>versione gratuita</strong> è già attiva e puoi iniziare subito.
                </p>
              </>
            )}
            <button
              onClick={() => switchMode('login')}
              className="mt-2 w-full py-3.5 rounded-2xl font-semibold text-white transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
                boxShadow: '0 4px 24px rgba(90,154,177,0.3)',
              }}
            >
              {mode === 'forgot-done' ? 'Torna al login' : 'Vai al login'}
            </button>
          </div>
        ) : (
          <>
            {/* Toggle login / registrazione — colori fissi (login sempre su sfondo scuro).
                Su iOS la registrazione non è disponibile (companion, solo login). */}
            {mode === 'forgot' ? (
              <div className="mt-8 mb-8 w-full text-center">
                <h2 className="text-lg font-bold text-white mb-1.5">Password dimenticata</h2>
                <p className="text-sm" style={{ color: 'rgba(247,250,252,0.6)' }}>
                  Inserisci la tua email: ti mandiamo un link per impostarne una nuova.
                </p>
              </div>
            ) : allowSignup ? (
              <div
                className="mt-8 mb-8 flex rounded-2xl p-1 w-full"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                {(['login', 'signup'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={
                      mode === m
                        ? { background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', boxShadow: '0 2px 10px rgba(0,0,0,0.28)' }
                        : { color: 'rgba(247,250,252,0.58)' }
                    }
                  >
                    {m === 'login' ? 'Accedi' : 'Registrati'}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-8 mb-8 text-center text-sm" style={{ color: 'rgba(247,250,252,0.6)' }}>
                Accedi con le credenziali del tuo account IST.
              </p>
            )}

            <form
              onSubmit={handleSubmit}
              onFocus={() => setKbFocus(true)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setKbFocus(false) }}
              className="w-full flex flex-col gap-4"
            >
              {mode === 'signup' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Il tuo nome"
                    className="w-full px-4 py-3 rounded-2xl placeholder:text-white/30 outline-none focus:ring-2 focus:ring-ist-400/50 transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#F7FAFC' }}
                  />
                </div>
              )}

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
                  style={{ background: 'var(--ist-w8)', border: '1px solid var(--ist-border)' }}
                />
              </div>

              {mode !== 'forgot' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-11 rounded-2xl text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-ist-400/50 transition-all"
                      style={{ background: 'var(--ist-w8)', border: '1px solid var(--ist-border)' }}
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
              )}

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
                  boxShadow: '0 4px 24px rgba(90,154,177,0.3)',
                }}
              >
                {loading
                  ? (mode === 'login' ? 'Accesso in corso...' : mode === 'forgot' ? 'Invio in corso...' : 'Registrazione...')
                  : (mode === 'login' ? 'Accedi' : mode === 'forgot' ? 'Inviami il link' : 'Prova gratis')}
              </button>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-center text-xs transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(247,250,252,0.55)' }}
                >
                  Password dimenticata?
                </button>
              )}

              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-center text-xs transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(247,250,252,0.55)' }}
                >
                  Torna al login
                </button>
              )}

              {mode === 'signup' && (
                <p className="text-center text-xs" style={{ color: 'rgba(247,250,252,0.55)' }}>
                  🎁 Accesso gratuito immediato alla versione di prova. Nessuna carta richiesta.
                </p>
              )}
            </form>
          </>
        )}
      </div>

      <div className="absolute bottom-8 text-center text-xs flex flex-col items-center gap-1.5" style={{ color: '#56636F' }}>
        <a href="/privacy" style={{ color: '#7CBBD0' }}>Privacy Policy</a>
        <span>© 2024 IST — Space Traders Institute</span>
      </div>
    </div>
  )
}
