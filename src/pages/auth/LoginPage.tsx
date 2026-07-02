import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ISTLogo from '../../components/ui/ISTLogo'

type Mode = 'login' | 'signup' | 'signup-done'

export default function LoginPage() {
  const { login, signup } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setName('')
    setEmail('')
    setPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'login') {
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
      className="min-h-screen flex flex-col items-center justify-center px-6"
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

        {mode === 'signup-done' ? (
          <div className="mt-10 w-full text-center flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(90,154,177,0.15)', border: '1px solid rgba(90,154,177,0.3)' }}
            >
              <svg className="w-7 h-7 text-ist-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg">Registrazione completata!</p>
            <p className="text-sm" style={{ color: '#8495A3' }}>
              Controlla la tua email per confermare l'account, poi accedi.
            </p>
            <button
              onClick={() => switchMode('login')}
              className="mt-2 w-full py-3.5 rounded-2xl font-semibold text-white transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
                boxShadow: '0 4px 24px rgba(90,154,177,0.3)',
              }}
            >
              Vai al login
            </button>
          </div>
        ) : (
          <>
            {/* Toggle login / registrazione — colori fissi (login sempre su sfondo scuro) */}
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

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
              {mode === 'signup' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
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
                  placeholder="la-tua@email.com"
                  className="w-full px-4 py-3 rounded-2xl text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-ist-400/50 transition-all"
                  style={{ background: 'var(--ist-w8)', border: '1px solid var(--ist-border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
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
                  ? (mode === 'login' ? 'Accesso in corso...' : 'Registrazione...')
                  : (mode === 'login' ? 'Accedi' : 'Crea account')}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="absolute bottom-8 text-center text-xs" style={{ color: '#56636F' }}>
        © 2024 IST — Space Traders Institute
      </p>
    </div>
  )
}
