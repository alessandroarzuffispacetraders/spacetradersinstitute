interface ISTLogoProps {
  size?: number
  className?: string
  showText?: boolean
}

// Logo mark: PNG ufficiale in /public/logo.png (cerchio blu con lo swoosh).
export default function ISTLogo({ size = 40, className = '', showText = false }: ISTLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/logo.png"
        alt="Space Traders Institute"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
        draggable={false}
      />
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
