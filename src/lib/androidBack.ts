import { useEffect, useRef } from 'react'

// ─── Gestione tasto/gesto "indietro" di Android ──────────────────────────────
// Registro a STACK di "interceptor". Ogni overlay/stato-tipo-indietro (modale,
// bottom sheet, viewer, chat aperta…) registra la sua azione mentre è aperto;
// il tasto indietro esegue quello IN CIMA allo stack (= l'ultimo aperto, quindi
// quello visivamente sopra). Così il gestore globale non deve conoscere i singoli
// overlay e la precedenza è automatica (LIFO). Vedi <AndroidBackHandler> in
// AppRouter.tsx, che chiama runBackInterceptors() sull'evento 'backButton'.

// Ritorna true se ha "consumato" il back (niente navigazione), false per lasciar passare.
type BackInterceptor = () => boolean

const stack: BackInterceptor[] = []

export function pushBackInterceptor(fn: BackInterceptor): () => void {
  stack.push(fn)
  return () => {
    const i = stack.lastIndexOf(fn)
    if (i >= 0) stack.splice(i, 1)
  }
}

// Esegue gli interceptor dall'alto verso il basso; il primo che consuma vince.
export function runBackInterceptors(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]()) return true
  }
  return false
}

// Hook: registra `handler` finché `enabled` è true (es. mentre un overlay è aperto).
// Il handler viene eseguito al back: ritorna `false` per NON consumare (lasciar
// passare al livello sotto); qualunque altro valore (o void) = consumato.
export function useBackInterceptor(handler: () => boolean | void, enabled: boolean) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!enabled) return
    return pushBackInterceptor(() => ref.current() !== false)
  }, [enabled])
}
