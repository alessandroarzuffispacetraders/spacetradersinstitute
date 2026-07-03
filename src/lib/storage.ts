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
async function resizeToBlob(file: File, max: number, quality = 0.85): Promise<Blob> {
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
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encoding fallito'))), 'image/jpeg', quality)
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

// ── Copertine categorie videocorsi (bucket pubblico 'category-covers') ────────
const COVER_BUCKET = 'category-covers'
const COVER_MAX = 1280 // lato max in px (banner largo)

// Carica la copertina (ridimensionata) di una categoria e ritorna l'URL pubblico
// (cache-busted). Scrittura riservata all'admin via RLS.
export async function uploadCategoryCover(categoryId: string, file: File): Promise<string | null> {
  try {
    const blob = await resizeToBlob(file, COVER_MAX, 0.82)
    const path = `${categoryId}/cover.jpg`
    const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (error) return null
    const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path)
    return `${data.publicUrl}?v=${Date.now()}`
  } catch {
    return null
  }
}

export async function deleteCategoryCover(categoryId: string): Promise<void> {
  await supabase.storage.from(COVER_BUCKET).remove([`${categoryId}/cover.jpg`])
}

// ── Immagini in chat (bucket pubblico 'chat-images') ──────────────────────────
const CHAT_IMAGE_BUCKET = 'chat-images'
const CHAT_IMAGE_MAX = 1280 // lato max in px
const CHAT_IMAGE_QUALITY = 0.7 // qualità ridotta → file leggeri sui server

// Ridimensiona/comprime l'immagine e la carica; ritorna l'URL pubblico.
export async function uploadChatImage(userId: string, file: File): Promise<string | null> {
  try {
    const blob = await resizeToBlob(file, CHAT_IMAGE_MAX, CHAT_IMAGE_QUALITY)
    const path = `${userId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from(CHAT_IMAGE_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (error) return null
    const { data } = supabase.storage.from(CHAT_IMAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

// ── Audio + file nelle chat private (bucket pubblico 'chat-media') ────────────
// Bucket condiviso da vocali e allegati: path <uid>/<uuid>.<ext> (non enumerabile).
// Il gating (audio ovunque nei DM, file solo staff) è enforced dalla RLS su messages.
const CHAT_MEDIA_BUCKET = 'chat-media'

// Vocali stile WhatsApp: il blob registrato viene caricato così com'è (già
// compresso in opus/aac dal MediaRecorder). `ext`/`mime` arrivano dal recorder.
export async function uploadChatAudio(
  userId: string,
  blob: Blob,
  ext: string,
  mime: string,
): Promise<string | null> {
  try {
    const path = `${userId}/${crypto.randomUUID()}.${ext || 'webm'}`
    const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, blob, {
      contentType: mime || blob.type || 'audio/webm',
      upsert: false,
    })
    if (error) return null
    const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

export interface UploadedChatFile {
  url: string
  name: string
  size: number
}

// Documenti + immagini allegabili dallo staff. Limite lato client (25 MB);
// la RLS blocca comunque i non-staff a prescindere.
export const CHAT_FILE_MAX_BYTES = 25 * 1024 * 1024

// Estensioni consentite (documenti). Le immagini passano dal filtro `image/*`.
const ALLOWED_FILE_EXT = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'zip',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic',
])

// `accept` per l'<input type="file"> (documenti + immagini).
export const CHAT_FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,image/*'

export function isAllowedChatFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_FILE_EXT.has(ext) || file.type.startsWith('image/')
}

// Carica un file (documento) e ritorna url + metadati per la riga messaggio.
export async function uploadChatFile(userId: string, file: File): Promise<UploadedChatFile | null> {
  try {
    const path = `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`
    const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (error) return null
    const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl, name: file.name, size: file.size }
  } catch {
    return null
  }
}
