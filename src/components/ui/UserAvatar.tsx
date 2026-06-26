import { User } from '../../types'

export const PRESET_AVATARS: { id: string; gradient: string; label: string }[] = [
  { id: 'blue',   gradient: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', label: 'Blu' },
  { id: 'purple', gradient: 'linear-gradient(135deg, #7C5AB1 0%, #3D2880 100%)', label: 'Viola' },
  { id: 'green',  gradient: 'linear-gradient(135deg, #5AB180 0%, #286640 100%)', label: 'Verde' },
  { id: 'orange', gradient: 'linear-gradient(135deg, #B1805A 0%, #804228 100%)', label: 'Arancio' },
  { id: 'pink',   gradient: 'linear-gradient(135deg, #B15A80 0%, #802855 100%)', label: 'Rosa' },
  { id: 'gold',   gradient: 'linear-gradient(135deg, #B1A05A 0%, #806828 100%)', label: 'Oro' },
  { id: 'cyan',   gradient: 'linear-gradient(135deg, #5AABB1 0%, #286880 100%)', label: 'Cyan' },
  { id: 'rose',   gradient: 'linear-gradient(135deg, #B15A5A 0%, #803028 100%)', label: 'Rosso' },
]

export function getAvatarGradient(presetId?: string): string {
  return PRESET_AVATARS.find(p => p.id === presetId)?.gradient
    ?? 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)'
}

interface UserAvatarProps {
  user: Pick<User, 'name' | 'avatarPreset' | 'avatarUrl'>
  size?: number
  className?: string
  onClick?: () => void
}

export default function UserAvatar({ user, size = 32, className = '', onClick }: UserAvatarProps) {
  const initial = user.name.charAt(0).toUpperCase()
  const fontSize = Math.max(10, Math.round(size * 0.38))

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        onClick={onClick}
        className={`rounded-full object-cover flex-shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-full flex items-center justify-center flex-shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: getAvatarGradient(user.avatarPreset),
      }}
    >
      <span className="font-semibold text-white" style={{ fontSize }}>{initial}</span>
    </div>
  )
}
