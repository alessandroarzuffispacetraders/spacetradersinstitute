import { vimeoEmbedSrc } from '../../lib/vimeo'

// Native Vimeo player via a responsive 16:9 iframe. Always dark.
export default function VimeoPlayer({ vimeoId, accent }: { vimeoId: string | null; accent: string }) {
  const src = vimeoId ? vimeoEmbedSrc(vimeoId) : null

  if (!src) {
    return (
      <div
        data-inverted="true"
        className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden flex items-center justify-center"
        style={{
          aspectRatio: '16/9',
          background: `radial-gradient(ellipse at 20% 30%, ${accent}28 0%, transparent 55%), #07090f`,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Video non ancora disponibile
        </p>
      </div>
    )
  }

  return (
    <div
      className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden"
      style={{
        aspectRatio: '16/9',
        background: '#000',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
      }}
    >
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        style={{ border: 0 }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title="Video lezione"
      />
    </div>
  )
}
