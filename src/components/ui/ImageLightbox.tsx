import { X } from 'lucide-react'
import ExerciseImage from './ExerciseImage'

// Full-screen viewer for a private exercise image. Click the backdrop or the X
// to close; clicking the image itself does not close.
export default function ImageLightbox({ objectKey, onClose }: { objectKey: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
        title="Chiudi"
      >
        <X size={18} strokeWidth={2} />
      </button>
      <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
        <ExerciseImage
          objectKey={objectKey}
          className="rounded-xl"
          style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain' }}
        />
      </div>
    </div>
  )
}
