import { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  premium?: boolean
}

export default function Card({ children, className = '', style, onClick, premium = false }: CardProps) {
  const baseStyle: CSSProperties = premium ? {
    borderRadius: '2rem',
    background: 'var(--ist-card-bg-premium)',
    border: '1px solid var(--ist-card-border-premium)',
    boxShadow: 'var(--ist-card-shadow-premium)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  } : {
    borderRadius: '2rem',
    background: 'var(--ist-card-bg)',
    border: '1px solid var(--ist-border)',
    boxShadow: 'var(--ist-card-shadow)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  }

  return (
    <div
      className={`ist-card rounded-4xl motion-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ ...baseStyle, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export interface GradientCardProps {
  title: string
  tag?: string
  gradient: string
  blob1?: string
  blob2?: string
  children?: ReactNode
  onClick?: () => void
  className?: string
  arrow?: boolean
}

export function GradientCard({
  title,
  tag,
  gradient,
  blob1 = 'bg-white/20',
  blob2 = 'bg-black/20',
  children,
  onClick,
  className = '',
  arrow = true,
}: GradientCardProps) {
  return (
    <div
      data-inverted="true"
      onClick={onClick}
      className={`relative overflow-hidden rounded-4xl cursor-pointer active:scale-[0.98] transition-transform duration-150 ${className}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full ${blob1} blur-sm`} />
      <div className={`absolute -bottom-16 -left-8 w-56 h-56 rounded-full ${blob2}`} />

      {arrow && (
        <div className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
          style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}
        >
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 17L17 7M7 7h10v10" />
          </svg>
        </div>
      )}

      <div className="relative z-10 p-5">
        {tag && (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-white/90 text-xs font-semibold mb-2"
            style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)' }}
          >
            {tag}
          </span>
        )}
        <h3 className="text-xl font-bold text-white leading-tight">{title}</h3>
        {children}
      </div>
    </div>
  )
}
