// Grafico a barre semplice (div-based, senza dipendenze) — theme-adaptive.
export default function BarChart({
  data,
  color,
  height = 128,
}: {
  data: { label: string; value: number }[]
  color: string
  height?: number
}) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * 100
        return (
          <div key={i} className="flex-1 flex flex-col items-center min-w-0 h-full">
            <div className="flex-1 w-full flex items-end justify-center">
              <div className="w-full flex flex-col items-center justify-end h-full">
                <span className="text-[9px] font-semibold mb-0.5" style={{ color: d.value > 0 ? 'var(--ist-text-muted)' : 'transparent' }}>
                  {d.value}
                </span>
                <div
                  className="rounded-t"
                  style={{
                    width: '68%',
                    height: `${h}%`,
                    minHeight: d.value > 0 ? 3 : 0,
                    background: `linear-gradient(180deg, ${color}, ${color}99)`,
                    boxShadow: d.value > 0 ? `0 0 10px ${color}40` : 'none',
                    transition: 'height .5s ease',
                  }}
                  title={`${d.label}: ${d.value}`}
                />
              </div>
            </div>
            <span className="text-[9px] mt-1 truncate w-full text-center" style={{ color: 'var(--ist-text-dim)' }}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
