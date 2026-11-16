// Controlli sulle colonne delle copertine (migrazioni non ancora applicate).
// La logica delle copertine (scorta, «Genera») è in coverPool.ts.

// Colonne delle copertine assenti (migrazione phase_video_covers.sql non ancora
// applicata): Postgres risponde 42703 "column … does not exist".
export function isMissingCoverColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42703' || /cover_(url|keyword|status|notes|error|updated_at)/i.test(err.message ?? '')
}

// Colonne delle locandine assenti (migrazione phase_series_posters.sql non ancora applicata).
export function isMissingPosterColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return /poster_(url|status|notes|error|updated_at)/i.test(err.message ?? '')
}

// Colonne dei vecchi soggetti per ChatGPT (phase_cover_prompts.sql, mai
// applicata): il catalogo le chiede solo se esistono.
export function isMissingPromptColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return /(cover|poster)_prompt/i.test(err.message ?? '')
}
