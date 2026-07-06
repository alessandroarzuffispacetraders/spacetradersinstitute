self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Deep-link "in sospeso" dopo il click su una notifica. Su iOS/PWA il
// postMessage può perdersi (app congelata) e openWindow può scartare l'URL:
// lo memorizziamo e l'app, al risveglio/avvio, ce lo chiede (ist-get-pending).
//
// IMPORTANTE: va persistito in modo DUREVOLE, non in una variabile in memoria.
// Su iOS il service worker viene spesso TERMINATO tra il tap sulla notifica e
// l'avvio della PWA: una variabile si azzererebbe e l'app aprirebbe la home
// invece della chat. Usiamo la Cache API, che sopravvive ai restart del SW.
const PENDING_CACHE = 'ist-pending-nav'
const PENDING_URL = '/__ist_pending_nav__'

async function savePending(url) {
  const cache = await caches.open(PENDING_CACHE)
  await cache.put(PENDING_URL, new Response(JSON.stringify({ url, at: Date.now() })))
}

// Legge e CONSUMA la destinazione in sospeso (freschezza max 2 min: copre
// l'avvio a freddo della PWA su iOS senza dirottare aperture successive).
async function takePending() {
  const cache = await caches.open(PENDING_CACHE)
  const res = await cache.match(PENDING_URL)
  if (!res) return null
  await cache.delete(PENDING_URL)
  const { url, at } = await res.json().catch(() => ({}))
  return url && typeof at === 'number' && (Date.now() - at < 120000) ? url : null
}

// L'app chiede l'eventuale destinazione in sospeso (al mount / quando torna in
// primo piano). Rispondiamo e la consumiamo.
self.addEventListener('message', e => {
  if (e.data?.type !== 'ist-get-pending') return
  e.waitUntil((async () => {
    const url = await takePending()
    e.source?.postMessage?.({ type: 'ist-navigate', url })
  })())
})

// Chiede a una finestra aperta se sta già guardando quel canale (risposta via
// MessageChannel, con timeout di sicurezza). Se sì → non mostriamo la push.
function isClientViewing(client, channelId) {
  return new Promise(resolve => {
    const mc = new MessageChannel()
    const timer = setTimeout(() => resolve(false), 400)
    mc.port1.onmessage = ev => { clearTimeout(timer); resolve(!!(ev.data && ev.data.viewing)) }
    try {
      client.postMessage({ type: 'ist-viewing?', channelId }, [mc.port2])
    } catch (_) {
      clearTimeout(timer); resolve(false)
    }
  })
}

self.addEventListener('push', e => {
  const data = e.data?.json() ?? {}
  e.waitUntil((async () => {
    // Se una finestra aperta sta già guardando quel canale, niente notifica
    // (il messaggio si vede già in chat).
    if (data.channel_id) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if (await isClientViewing(client, data.channel_id)) return
      }
    }
    await self.registration.showNotification(data.title ?? 'IST', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Raggruppa le notifiche dello stesso canale così non si accumulano.
      tag: data.channel_id || undefined,
      data: data.url ? { url: data.url } : undefined,
    })
  })())
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url
  if (!url) return
  e.waitUntil((async () => {
    // Memorizza (in modo durevole) la destinazione: se il postMessage/openWindow
    // non basta — tipico su iOS, dove la PWA riparte a freddo dalla start_url —
    // l'app la recupera con ist-get-pending appena diventa visibile.
    await savePending(url)
    // Se c'è già una finestra dell'app aperta, portala in primo piano e
    // naviga in-app (soft, senza reload) via postMessage; altrimenti aprine una.
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      await client.focus().catch(() => {})
      client.postMessage({ type: 'ist-navigate', url })
      return
    }
    if (self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
