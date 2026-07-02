import { supabase } from './supabase'
import type { Attachment } from './content'

// Lesson attachments live in the private Supabase Storage bucket
// 'lesson-attachments'; metadata rows live in public.attachments.

const BUCKET = 'lesson-attachments'

const EXT_TYPE: Record<string, Attachment['type']> = {
  pdf: 'pdf',
  xlsx: 'xlsx', xls: 'xlsx', csv: 'xlsx',
  docx: 'docx', doc: 'docx',
  pptx: 'pptx', ppt: 'pptx',
  zip: 'zip',
}

function typeFromName(name: string): Attachment['type'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TYPE[ext] ?? 'pdf'
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'
}

// Upload the file to Storage then create its attachments row. Best-effort
// cleanup of the object if the row insert fails.
export async function uploadAttachment(lessonId: string, file: File, position: number): Promise<boolean> {
  const path = `${lessonId}/${crypto.randomUUID()}-${safeName(file.name)}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (upErr) return false

  const { error: rowErr } = await supabase.from('attachments').insert({
    lesson_id: lessonId,
    name: file.name,
    type: typeFromName(file.name),
    size_bytes: file.size,
    object_key: path,
    position,
  })
  if (rowErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return false
  }
  return true
}

export async function deleteAttachment(id: string, objectKey: string | null): Promise<boolean> {
  if (objectKey) await supabase.storage.from(BUCKET).remove([objectKey])
  const { error } = await supabase.from('attachments').delete().eq('id', id)
  return !error
}

// Short-lived signed URL to download/open an attachment (bucket is private).
export async function attachmentUrl(objectKey: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectKey, 3600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

// ── Foto profilo (bucket pubblico 'avatars') ──────────────────────────────────
const AVATAR_BUCKET = 'avatars'
const AVATAR_MAX = 256 // lato max in px: l'avatar si vede al massimo ~80px

// Ridimensiona e comprime lato client → file piccolo (no immagini enormi nel DB/rete).
async function resizeToBlob(file: File, max: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas non disponibile')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encoding fallito'))), 'image/jpeg', 0.85)
  )
}

// Carica la foto profilo (ridimensionata) e ritorna l'URL pubblico (cache-busted).
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  try {
    const blob = await resizeToBlob(file, AVATAR_MAX)
    const path = `${userId}/avatar.jpg`
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (error) return null
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    // Path fisso + upsert → stesso URL: aggiungo ?v= per bypassare la cache.
    return `${data.publicUrl}?v=${Date.now()}`
  } catch {
    return null
  }
}

export async function deleteAvatar(userId: string): Promise<void> {
  await supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar.jpg`])
}
