import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import ISTLogo from '../../components/ui/ISTLogo'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await login(email, password)
    if (error) setError('Email o password non corretti')
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{
        background: 'radial-gradient(circle at 20% 10%, rgba(90,154,177,0.28) 0%, transparent 34%), radial-gradient(circle at 80% 20%, rgba(40,102,128,0.22) 0%, transparent 32%), linear-gradient(135deg, #070812 0%, #0B1020 52%, #061D2A 100%)',
      }}
    >
      {/* Glow bg */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(90,154,177,0.20) 0%, transparent 65%)' }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Logo + titolo */}
        <ISTLogo size={64} showText={false} className="mb-6" />
        <p className="text-ist-300 text-xs font-semibold tracking-[0.3em] uppercase mb-1">Institute</p>
        <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-1">
          Space Traders
        </h1>
        <p className="text-sm mt-3 mb-10" style={{ color: '#8495A3' }}>
          Accedi alla piattaforma
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="la-tua@email.com"
              className="w-full px-4 py-3 rounded-2xl text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-ist-400/50 transition-all"
              style={{
                background: 'var(--ist-w8)',
                border: '1px solid var(--ist-border)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ist-300 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-2xl text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-ist-400/50 transition-all"
              style={{
                background: 'var(--ist-w8)',
                border: '1px solid var(--ist-border)',
              }}
            />
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
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>
      </div>

      <p className="absolute bottom-8 text-center text-xs" style={{ color: '#56636F' }}>
        © 2024 IST — Space Traders Institute
      </p>
    </div>
  )
}
