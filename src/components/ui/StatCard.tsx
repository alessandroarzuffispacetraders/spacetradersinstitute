interface StatCardProps {
  label: string
  value: string | number
  icon: string
  trend?: string
  trendUp?: boolean
}

export default function StatCard({ label, value, icon, trend, trendUp }: StatCardProps) {
  return (
    <div
      className="ist-card rounded-4xl p-5 motion-card"
      style={{
        borderRadius: '2rem',
        background: 'var(--ist-card-bg)',
        border: '1px solid var(--ist-border)',
        boxShadow: 'var(--ist-card-shadow)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={trendUp
              ? { color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' }
              : { color: '#FF6B7A', background: 'rgba(255,107,122,0.14)', border: '1px solid rgba(255,107,122,0.22)' }
            }
          >
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--ist-text)' }}>{value}</p>
      <p className="text-sm mt-0.5 ist-text-muted">{label}</p>
    </div>
  )
}
