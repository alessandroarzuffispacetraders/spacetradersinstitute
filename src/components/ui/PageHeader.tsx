import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ist-text)' }}>{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm ist-text-muted">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
