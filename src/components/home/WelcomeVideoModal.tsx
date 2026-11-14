import { X } from 'lucide-react'
import VimeoPlayer from '../ui/VimeoPlayer'

// Video di benvenuto a schermo (dalla slide "Benvenuto" del banner della Home).
export default function WelcomeVideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: 'rgba(255,255,255,0.14)' }} aria-label="Chiudi">
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>
        <VimeoPlayer vimeoId={url} accent="#5A9AB1" />
      </div>
    </div>
  )
}
