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
