import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

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

export function useDiaryEntries(userId: string) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [userId])

  const addEntry = useCallback(async (e: NewDiaryEntry): Promise<boolean> => {
    if (!userId) return false
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
  }, [userId])

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    setEntries(prev => prev.filter(e => e.id !== id))
    await supabase.from('diary_entries').delete().eq('id', id)
  }, [])

  return { entries, loading, addEntry, deleteEntry }
}
