// Traccia quale canale/DM chat è attualmente APERTO in primo piano, così le
// notifiche (in-app e push) del canale che stai già guardando vengono soppresse.
// La ChatArea imposta il canale al mount e lo azzera allo smontaggio.

let current: string | null = null

export function setActiveChat(id: string | null) {
  current = id
}

// True se stai guardando proprio quel canale E la scheda è visibile (non in
// background). Se sei su un altro canale/pagina o la tab è nascosta → false.
export function isViewingChannel(channelId: string): boolean {
  if (!channelId || current !== channelId) return false
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}
