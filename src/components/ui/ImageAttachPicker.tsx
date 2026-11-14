import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { uploadChatImage } from '../../lib/storage'
import { useAuth } from '../../context/AuthContext'

// Immagini allegate a un post (annunci): caricate subito, compresse, nel bucket
// pubblico delle immagini di chat. onBusy segnala gli upload in corso.
export default function ImageAttachPicker({ images, onChange, onBusy, max = 4 }: {
  images: string[]
  onChange: (urls: string[]) => void
  onBusy?: (busy: boolean) => void
  max?: number
}) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const latest = useRef(images)
  latest.current = images

  const add = async (files: FileList | null) => {
    if (!files || !user) return
    const list = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, max - images.length - uploading)
    if (!list.length) return
    setError(''); setUploading(n => n + list.length); onBusy?.(true)
    let pending = list.length
    for (const f of list) {
      const url = await uploadChatImage(user.id, f)
      pending -= 1
      setUploading(n => n - 1)
      if (url && latest.current.length < max) onChange([...latest.current, url])
      else if (!url) setError('Una immagine non è stata caricata. Riprova.')
      if (pending === 0) onBusy?.(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {images.map(url => (
          <div key={url} className="relative aspect-square rounded-xl overflow-hidden" style={{ background: 'var(--ist-w6)' }}>
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange(images.filter(u => u !== url))} className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="aspect-square rounded-xl flex items-center justify-center" style={{ background: 'var(--ist-w6)' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} />
          </div>
        ))}
        {images.length + uploading < max && (
          <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-semibold" style={{ border: '1px dashed var(--ist-w20)', color: 'var(--ist-text-muted)' }}>
            <ImagePlus size={18} strokeWidth={2} />
            Aggiungi
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { void add(e.target.files); e.target.value = '' }} />
      {error && <p className="text-[11px] mt-1.5" style={{ color: '#FF6B7A' }}>{error}</p>}
    </div>
  )
}
