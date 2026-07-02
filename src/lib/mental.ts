import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useIsPreview } from './previewMode'

// ─── Tipi ───────────────────────────────────────────────────────────────────────

export type MentalMaterialType = 'pdf' | 'audio' | 'video' | 'task' | 'link'

export interface MentalMaterial {
  id: string
  title: string
  type: MentalMaterialType
  url: string | null
  position: number
}

export interface MentalChecklistItem {
  id: string
  label: string
  position: number
}

// Dati FINTI per l'anteprima (vedi previewMode).
const PREVIEW_MATERIALS: MentalMaterial[] = [
  { id: 'pv-mat1', title: 'Meditazione pre-market (10 min)', type: 'audio', url: '#', position: 0 },
  { id: 'pv-mat2', title: 'Guida: gestire il tilt dopo una perdita', type: 'pdf', url: '#', position: 1 },
  { id: 'pv-mat3', title: 'Video: routine mentale del trader', type: 'video', url: '#', position: 2 },
]
const PREVIEW_CHECKLIST: MentalChecklistItem[] = [
  { id: 'pv-chk1', label: 'Respirazione 4-7-8 prima della sessione', position: 0 },
  { id: 'pv-chk2', label: 'Rileggere le regole di rischio', position: 1 },
  { id: 'pv-chk3', label: 'Nessun trade sotto stress emotivo', position: 2 },
  { id: 'pv-chk4', label: 'Chiudere la piattaforma dopo 2 stop', position: 3 },
]
const PREVIEW_CHECKLIST_DONE = new Set(['pv-chk1', 'pv-chk2'])

// ─── Studente: materiali (sola lettura) ─────────────────────────────────────────

export function useMentalMaterials() {
  const preview = useIsPreview()
  const [materials, setMaterials] = useState<MentalMaterial[]>(preview ? PREVIEW_MATERIALS : [])
  const [loading, setLoading] = useState(!preview)

  useEffect(() => {
    if (preview) return
    let active = true
    supabase.from('mental_materials').select('id,title,type,url,position').order('position').then(({ data }) => {
      if (!active) return
      setMaterials((data as MentalMaterial[]) ?? [])
      setLoading(false)
    })
    return () => { active = false }
  }, [preview])

  return { materials, loading }
}

// ─── Studente: checklist (definizioni globali + completamento proprio, self-check) ─

export function useMentalChecklist(userId: string) {
  const preview = useIsPreview()
  const [items, setItems] = useState<MentalChecklistItem[]>(preview ? PREVIEW_CHECKLIST : [])
  const [doneIds, setDoneIds] = useState<Set<string>>(preview ? PREVIEW_CHECKLIST_DONE : new Set())
  const [loading, setLoading] = useState(!preview)

  const load = useCallback(async () => {
    if (preview) return
    if (!userId) { setLoading(false); return }
    setLoading(true)
    const [defsRes, doneRes] = await Promise.all([
      supabase.from('mental_checklist_defs').select('id,label,position').order('position'),
      supabase.from('mental_checklist_done').select('item_id').eq('user_id', userId),
    ])
    setItems((defsRes.data as MentalChecklistItem[]) ?? [])
    setDoneIds(new Set((doneRes.data ?? []).map(r => r.item_id as string)))
    setLoading(false)
  }, [userId, preview])

  useEffect(() => { load() }, [load])

  // Lo studente spunta/despunta i propri item.
  const toggle = useCallback(async (itemId: string, done: boolean): Promise<boolean> => {
    if (preview) return true
    if (done) {
      const { error } = await supabase.from('mental_checklist_done')
        .upsert({ user_id: userId, item_id: itemId }, { onConflict: 'user_id,item_id' })
      if (error) return false
      setDoneIds(prev => new Set(prev).add(itemId))
    } else {
      const { error } = await supabase.from('mental_checklist_done')
        .delete().eq('user_id', userId).eq('item_id', itemId)
      if (error) return false
      setDoneIds(prev => { const n = new Set(prev); n.delete(itemId); return n })
    }
    return true
  }, [userId, preview])

  return { items, doneIds, loading, toggle, reload: load }
}

// ─── Admin: CRUD materiali ──────────────────────────────────────────────────────

export interface MaterialInput { title: string; type: MentalMaterialType; url: string }

export function useMentalMaterialsAdmin() {
  const [materials, setMaterials] = useState<MentalMaterial[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('mental_materials').select('id,title,type,url,position').order('position')
    setMaterials((data as MentalMaterial[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addMaterial = useCallback(async (input: MaterialInput): Promise<boolean> => {
    if (!input.title.trim()) return false
    const { error } = await supabase.from('mental_materials').insert({
      title: input.title.trim(), type: input.type, url: input.url.trim() || null, position: materials.length,
    })
    if (!error) await load()
    return !error
  }, [materials.length, load])

  const updateMaterial = useCallback(async (id: string, input: MaterialInput): Promise<boolean> => {
    if (!input.title.trim()) return false
    const { error } = await supabase.from('mental_materials').update({
      title: input.title.trim(), type: input.type, url: input.url.trim() || null,
    }).eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  const deleteMaterial = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('mental_materials').delete().eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  const moveMaterial = useCallback(async (id: string, dir: 'up' | 'down'): Promise<boolean> => {
    const sorted = [...materials].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(m => m.id === id)
    const swapWith = dir === 'up' ? sorted[idx - 1] : sorted[idx + 1]
    if (idx < 0 || !swapWith) return false
    const cur = sorted[idx]
    const { error: e1 } = await supabase.from('mental_materials').update({ position: swapWith.position }).eq('id', cur.id)
    const { error: e2 } = await supabase.from('mental_materials').update({ position: cur.position }).eq('id', swapWith.id)
    if (!e1 && !e2) await load()
    return !e1 && !e2
  }, [materials, load])

  return { materials, loading, addMaterial, updateMaterial, deleteMaterial, moveMaterial, reload: load }
}

// ─── Admin: CRUD checklist ──────────────────────────────────────────────────────

export function useMentalChecklistAdmin() {
  const [items, setItems] = useState<MentalChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('mental_checklist_defs').select('id,label,position').order('position')
    setItems((data as MentalChecklistItem[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addItem = useCallback(async (label: string): Promise<boolean> => {
    const l = label.trim()
    if (!l) return false
    const { error } = await supabase.from('mental_checklist_defs').insert({ label: l, position: items.length })
    if (!error) await load()
    return !error
  }, [items.length, load])

  const updateItem = useCallback(async (id: string, label: string): Promise<boolean> => {
    const l = label.trim()
    if (!l) return false
    const { error } = await supabase.from('mental_checklist_defs').update({ label: l }).eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('mental_checklist_defs').delete().eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  const moveItem = useCallback(async (id: string, dir: 'up' | 'down'): Promise<boolean> => {
    const sorted = [...items].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(m => m.id === id)
    const swapWith = dir === 'up' ? sorted[idx - 1] : sorted[idx + 1]
    if (idx < 0 || !swapWith) return false
    const cur = sorted[idx]
    const { error: e1 } = await supabase.from('mental_checklist_defs').update({ position: swapWith.position }).eq('id', cur.id)
    const { error: e2 } = await supabase.from('mental_checklist_defs').update({ position: cur.position }).eq('id', swapWith.id)
    if (!e1 && !e2) await load()
    return !e1 && !e2
  }, [items, load])

  return { items, loading, addItem, updateItem, deleteItem, moveItem, reload: load }
}
