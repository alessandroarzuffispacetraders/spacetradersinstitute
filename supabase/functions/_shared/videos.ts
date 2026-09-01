// Titoli dei videocorsi (SOLO titoli/categoria/corso — mai descrizione, mai
// vimeo_id/video_key) per dare all'assistente Quant-Brain la possibilità di
// consigliare una lezione pertinente, senza mai esporre il video vero e
// proprio. Interroga con un client "come l'utente" (bearer token, non
// service-role): l'elenco rispetta ESATTAMENTE ciò che quello studente può
// vedere (RLS + gating free/a pagamento) — mai un consiglio che poi non
// riuscirebbe ad aprire.
import { createClient } from 'npm:@supabase/supabase-js@2'

export interface VideoTitle { id: string; title: string; corso: string; categoria: string }

interface RawLezione { id: string; title: string; published: boolean }
interface RawCorso { title: string; lessons: RawLezione[] | null }
interface RawCategoria { title: string; courses: RawCorso[] | null }

export async function loadVideoTitles(token: string): Promise<VideoTitle[]> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await asUser
    .from('categories')
    .select('title, courses(title, lessons(id, title, published))')
    .eq('published', true)
  if (error || !data) return [] // non bloccante: la chat funziona comunque, solo senza consigli video

  const videos: VideoTitle[] = []
  for (const cat of data as unknown as RawCategoria[]) {
    for (const course of cat.courses ?? []) {
      for (const lesson of course.lessons ?? []) {
        if (lesson.published) videos.push({ id: lesson.id, title: lesson.title, corso: course.title, categoria: cat.title })
      }
    }
  }
  return videos
}

export function buildVideoText(videos: VideoTitle[]): string {
  if (videos.length === 0) return ''
  return videos.map(v => `- ${v.title} (${v.categoria} → ${v.corso})`).join('\n')
}

export function buildVideoIndex(videos: VideoTitle[]): Map<string, VideoTitle> {
  const index = new Map<string, VideoTitle>()
  for (const v of videos) index.set(v.title.toLowerCase(), v)
  return index
}

// Estrae i video citati come {{Titolo esatto}} — stessa logica di
// extractWikilinkTitles in vault.ts, ma con sintassi diversa apposta per non
// confondersi con le citazioni [[Nota]] del manuale. Titoli non risolvibili
// (allucinati, non nell'elenco) vengono scartati in silenzio.
export function extractVideoTitles(text: string, index: Map<string, VideoTitle>): VideoTitle[] {
  const out: VideoTitle[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) {
    const v = index.get(m[1].trim().toLowerCase())
    if (v && !seen.has(v.id)) { seen.add(v.id); out.push(v) }
  }
  return out
}
