import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useIsPreview } from './previewMode'

export interface DiaryEntry {
  id: string
  user_id: string
  entry_date: string        // 'YYYY-MM-DD'
  result: string | null
  trades_count: number | null
  emotion: string | null
  notes: string | null
  created_at: string
}

export interface NewDiaryEntry {
  result: string
  trades_count: number | null
  emotion: string
  notes: string
  entry_date?: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Dati FINTI per l'anteprima (vedi previewMode).
const PREVIEW_ENTRIES: DiaryEntry[] = [
  { id: 'pv1', user_id: 'preview', entry_date: '2026-06-29', result: '+€240', trades_count: 4, emotion: '😊', notes: 'Rispettato il piano, ingressi puliti sui livelli. Buona gestione emotiva.', created_at: '2026-06-29T20:00:00Z' },
  { id: 'pv2', user_id: 'preview', entry_date: '2026-06-27', result: '-€80', trades_count: 3, emotion: '😐', notes: 'Entrato in anticipo su un breakout. Da rivedere il timing di ingresso.', created_at: '2026-06-27T20:00:00Z' },
  { id: 'pv3', user_id: 'preview', entry_date: '2026-06-25', result: '+€60', trades_count: 6, emotion: '😤', notes: 'Troppi trade, un po\' di overtrading nel pomeriggio. Chiuso comunque in verde.', created_at: '2026-06-25T20:00:00Z' },
]

export function useDiaryEntries(userId: string) {
  const preview = useIsPreview()
  const [entries, setEntries] = useState<DiaryEntry[]>(preview ? PREVIEW_ENTRIES : [])
  const [loading, setLoading] = useState(!preview)

  useEffect(() => {
    if (preview) return
    if (!userId) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEntries((data as DiaryEntry[]) ?? [])
        setLoading(false)
      })
  }, [userId, preview])

  const addEntry = useCallback(async (e: NewDiaryEntry): Promise<boolean> => {
    if (preview || !userId) return false
    const { data, error } = await supabase
      .from('diary_entries')
      .insert({
        user_id: userId,
        entry_date: e.entry_date ?? todayISO(),
        result: e.result.trim() || null,
        trades_count: e.trades_count,
        emotion: e.emotion || null,
        notes: e.notes.trim() || null,
      })
      .select()
      .single()
    if (error || !data) return false
    setEntries(prev => [data as DiaryEntry, ...prev])
    return true
  }, [userId, preview])

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    if (preview) return
    setEntries(prev => prev.filter(e => e.id !== id))
    await supabase.from('diary_entries').delete().eq('id', id)
  }, [preview])

  return { entries, loading, addEntry, deleteEntry }
}
