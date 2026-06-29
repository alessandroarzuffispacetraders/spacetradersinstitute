import { useEffect, useState } from 'react'
import { exerciseFileUrl } from '../../lib/assignments'

// Resolves a private exercise-files object_key to a short-lived signed URL and
// renders it as an <img>. Shows a neutral placeholder while loading.
export default function ExerciseImage({ objectKey, className, style, onClick, alt }: {
  objectKey: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  alt?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setUrl(null)
    exerciseFileUrl(objectKey).then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [objectKey])

  if (!url) {
    return <div onClick={onClick} className={className} style={{ ...style, background: 'var(--ist-w8)' }} />
  }
  return <img src={url} alt={alt ?? ''} onClick={onClick} className={className} style={style} />
}
