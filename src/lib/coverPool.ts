import { claimLessonCover, claimLiveCover, claimPosterCover, keywordFromTitle, type ClaimResult } from './live'

// Copertine di lezioni e live e locandine verticali delle sezioni.
//
// Tutte nello stesso stile: grafici quant "fotografati" (scripts/covers),
// ognuna con la versione scura e quella chiara. Le immagini sono già pronte in
// una scorta (tabella cover_pool): «Genera» ne assegna subito una mai usata,
// scelta per tema e per le parole del titolo (funzioni claim_* del database).
// Quando la scorta finisce se ne preparano altre con scripts/covers/plan_pool.py.

export type CoverKind = 'lesson' | 'live' | 'category'

// Immagine della scorta o delle copertine curate (stesso stile, con versione
// chiara). Le altre (vecchie illustrazioni vettoriali, immagini caricate a mano)
// vanno sostituite.
export function isStyledCover(url: string | null | undefined): boolean {
  return !!url && /\/video-covers\/curated\//.test(url)
}

export type { ClaimResult }

// Assegna (o cambia) la copertina dalla scorta. Lezioni e live: se non hanno
// ancora una parola chiave, la ricaviamo dal titolo.
export function claimCover(kind: CoverKind, id: string, opts: { title?: string; keyword?: string | null; force?: boolean } = {}): Promise<ClaimResult> {
  const kw = opts.keyword?.trim() ? null : (opts.title ? keywordFromTitle(opts.title) : null)
  const force = opts.force ?? false
  if (kind === 'lesson') return claimLessonCover(id, kw, force)
  if (kind === 'live') return claimLiveCover(id, kw, force)
  return claimPosterCover(id, force)
}

// Messaggio per l'admin dopo un'assegnazione.
export function claimMessage(res: ClaimResult, kind: CoverKind): { ok: boolean; text: string } {
  const noun = kind === 'category' ? 'Locandina' : 'Copertina'
  if (res.status === 'ok' || res.status === 'other_theme') {
    const left = res.left !== undefined ? ` · nella scorta ne restano ${res.left}` : ''
    return { ok: true, text: `${noun} pronta, in versione scura e chiara${left}.` }
  }
  if (res.status === 'kept') return { ok: true, text: `${noun} già presente.` }
  if (res.status === 'empty') return { ok: false, text: 'La scorta di copertine è finita: vanno preparate immagini nuove.' }
  if (res.status === 'unavailable') return { ok: false, text: "Manca l'aggiornamento del database (phase_cover_pool_posters.sql)." }
  return { ok: false, text: 'Non è stato possibile assegnare la copertina. Riprova.' }
}
