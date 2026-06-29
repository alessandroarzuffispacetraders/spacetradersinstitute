import { supabase } from './supabase'

// Client wrappers around the R2 presign edge functions. The browser uploads
// bytes straight to R2 with the presigned PUT URL, and plays/downloads with a
// presigned GET URL. No R2 credentials are ever exposed here.

export interface PresignUploadInput {
  kind: 'video' | 'attachment'
  lessonId: string
  filename: string
}

export async function presignUpload(input: PresignUploadInput): Promise<{ uploadUrl: string; objectKey: string } | null> {
  const { data, error } = await supabase.functions.invoke('r2-presign-upload', { body: input })
  if (error || !data?.uploadUrl || !data?.objectKey) return null
  return { uploadUrl: data.uploadUrl as string, objectKey: data.objectKey as string }
}

// PUT the file to R2. Uses XHR (not fetch) to report upload progress.
export function uploadToR2(uploadUrl: string, file: File, onProgress?: (pct: number) => void): Promise<boolean> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    if (file.type) xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = e => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
    xhr.onerror = () => resolve(false)
    xhr.send(file)
  })
}

export async function presignView(objectKey: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('r2-presign-view', { body: { objectKey } })
  if (error || !data?.url) return null
  return data.url as string
}
