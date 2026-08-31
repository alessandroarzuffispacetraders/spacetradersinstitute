import type { SVGProps } from 'react'

// Icona di Quant-Brain: un nodo centrale con 3 satelliti sparsi in modo
// asimmetrico (angoli e distanze diverse, non tutti dallo stesso lato),
// ciascuno collegato SOLO al centro — richiama il grafo di conoscenza della
// sezione senza essere un'icona Lucide generica. Stessa interfaccia di un
// LucideIcon (size/className/style/strokeWidth) per essere intercambiabile
// nelle stesse mappe icone del resto della nav.
interface QuantBrainIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
}

export default function QuantBrainIcon({ size = 20, strokeWidth = 1.6, ...rest }: QuantBrainIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <line x1="12" y1="12.5" x2="5.5" y2="7" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1="12" y1="12.5" x2="19" y2="8.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1="12" y1="12.5" x2="15" y2="19.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="5.5" cy="7" r="1.7" fill="currentColor" />
      <circle cx="19" cy="8.5" r="1.4" fill="currentColor" />
      <circle cx="15" cy="19.5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12.5" r="3" fill="currentColor" />
    </svg>
  )
}
