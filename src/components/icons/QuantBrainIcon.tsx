import type { SVGProps } from 'react'

// Icona di Quant-Brain: un nodo centrale con 3 satelliti che formano tra loro
// un triangolo quasi equilatero, a distanze diverse dal centro (non tutti
// dallo stesso lato né alla stessa distanza), ciascuno collegato SOLO al
// centro — richiama lo stile dei nodi del grafo di conoscenza della sezione
// (pallini pieni + linee sottili), non un'icona Lucide generica. Lo spessore
// delle linee è FISSO e non segue lo
// `strokeWidth` che il resto della nav passa (pensato per icone a tratto
// uniforme, non per un piccolo logo a nodi): altrimenti a 2px le linee
// risultano più pesanti dei pallini satellite e lo squilibrio è ciò che
// rendeva l'icona "bruttina". Stessa interfaccia di un LucideIcon
// (size/className/style) per essere intercambiabile nelle stesse mappe
// icone del resto della nav.
interface QuantBrainIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
}

export default function QuantBrainIcon({ size = 20, ...rest }: QuantBrainIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <line x1="12" y1="12.2" x2="6.2" y2="7.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="12.2" x2="20" y2="9.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="12.2" x2="11.4" y2="20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="12.2" r="4.2" fill="currentColor" />
      <circle cx="6.2" cy="7.4" r="1.8" fill="currentColor" />
      <circle cx="20" cy="9.1" r="1.6" fill="currentColor" />
      <circle cx="11.4" cy="20" r="2.1" fill="currentColor" />
    </svg>
  )
}
