// Push NATIVE (APNs su iOS) tramite @capacitor/push-notifications. Sul web tutto
// è no-op: là le notifiche restano gestite da push.ts (Web Push + VAPID) e dal
// service worker. Qui, dentro il guscio nativo, il permesso e il device token
// sono nativi → il token va salvato su Supabase (register_native_push_subscription)
// e send-push lo raggiunge via APNs.
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'

const isNative = () => Capacitor.isNativePlatform()

let listenersReady = false

// Prepara i listener (una sola volta) e chiede il permesso notifiche. Il tap su
// una notifica (app in background/chiusa) chiama onNavigate col deep-link.
export async function ensureNativePushReady(onNavigate: (url: string) => void) {
  if (!isNative() || listenersReady) return
  listenersReady = true

  // I listener vanno registrati PRIMA di register(), o si perde 'registration'.
  await PushNotifications.addListener('registration', async (token) => {
    // token.value = device token APNs → lo rivendichiamo per l'utente corrente.
    try {
      await supabase.rpc('register_native_push_subscription', {
        p_token: token.value,
        p_platform: Capacitor.getPlatform(), // 'ios' | 'android'
      })
    } catch (err) {
      console.warn('register_native_push_subscription:', err)
    }
  })

  await PushNotifications.addListener('registrationError', (err) => {
    // Atteso finché in Xcode non è abilitata la capability "Push Notifications"
    // e non c'è un profilo con APNs (serve l'account Apple Developer a pagamento).
    console.warn('Native push registrationError:', (err as any)?.error ?? err)
  })

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = (action.notification?.data as { url?: string } | undefined)?.url
    if (typeof url === 'string' && url) onNavigate(url)
  })

  // Notifica ricevuta con app in FOREGROUND: iOS non la mostra da sola e la chat
  // è già realtime in-app → per ora nessuna azione. TODO (opzionale): presentare
  // un banner in-foreground via @capacitor/local-notifications.
  await PushNotifications.addListener('pushNotificationReceived', () => {})

  // Chiede il permesso una sola volta (se ancora da decidere).
  try {
    const perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      await PushNotifications.requestPermissions()
    }
  } catch (err) {
    console.warn('Native push permission:', err)
  }
}

// Registra il dispositivo col sistema → fa scattare 'registration' e quindi la
// RPC, che associa QUESTO device token all'utente attualmente loggato (un device
// appartiene all'ultimo utente che vi ha fatto login). Da richiamare a ogni
// cambio utente. No-op se il permesso non è concesso.
export async function claimNativePush() {
  if (!isNative()) return
  try {
    const perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'granted') await PushNotifications.register()
  } catch (err) {
    console.warn('claimNativePush:', err)
  }
}
