interface ISTLogoProps {
  size?: number
  className?: string
  showText?: boolean
}

export default function ISTLogo({ size = 40, className = '', showText = false }: ISTLogoProps) {
  const id = `ist-grad-${size}`
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={id} x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5ba8c4" />
            <stop offset="100%" stopColor="#183d52" />
          </linearGradient>
          <clipPath id={`clip-${id}`}>
            <circle cx="50" cy="50" r="48" />
          </clipPath>
        </defs>
        {/* Background circle */}
        <circle cx="50" cy="50" r="48" fill={`url(#${id})`} />
        {/* Main diagonal slash — wide cut */}
        <path
          d="M 18 8 L 82 92"
          stroke="white"
          strokeWidth="11"
          strokeLinecap="round"
          clipPath={`url(#clip-${id})`}
        />
        {/* Secondary thin slash bottom right */}
        <path
          d="M 52 42 L 78 92"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          clipPath={`url(#clip-${id})`}
        />
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-semibold tracking-[0.2em] text-ist-300 uppercase">Institute</span>
          <span className="text-lg font-bold tracking-[0.08em] text-white leading-tight">SPACE</span>
          <span className="text-lg font-bold tracking-[0.08em] text-white leading-tight">TRADERS</span>
        </div>
      )}
    </div>
  )
}
