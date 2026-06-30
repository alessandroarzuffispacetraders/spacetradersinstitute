import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string) + '/functions/v1'

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const reg = await navigator.serviceWorker.ready

    // Riusa la subscription esistente se c'è, altrimenti crea
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: Record<string, string> }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, endpoint, keys }, { onConflict: 'user_id,endpoint' })

    return !error
  } catch (err) {
    console.error('subscribeToPush:', err)
    return false
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
  } catch (err) {
    console.error('unsubscribeFromPush:', err)
  }
}

// Chiamato dal client dopo ogni invio di messaggio — fire & forget
export function triggerPushNotifications(message: {
  channel_id: string
  user_id: string
  author_name: string
  content: string
}) {
  supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token
    if (!token) return
    fetch(`${FUNCTIONS_URL}/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    }).catch(() => {/* ignora errori di rete */})
  })
}

// Notifica push agli admin quando un coach apre una segnalazione "alta priorità".
// Il client passa solo un tipo fisso: testo e destinatari (role=admin) sono decisi
// server-side dalla edge function, così non si possono inviare push arbitrarie.
export function triggerStudentFlagNotification(studentName: string | null) {
  supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token
    if (!token) return
    fetch(`${FUNCTIONS_URL}/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notify: { type: 'student_flag_high', studentName } }),
    }).catch(() => {/* ignora errori di rete */})
  })
}
