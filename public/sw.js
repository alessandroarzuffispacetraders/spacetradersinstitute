self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Deep-link "in sospeso" dopo il click su una notifica. Su iOS/PWA il
// postMessage può perdersi (app congelata) e openWindow può scartare l'URL:
// lo memorizziamo qui e l'app, al risveglio/avvio, ce lo chiede (ist-get-pending).
let pendingNav = null // { url, at }

// L'app chiede l'eventuale destinazione in sospeso (al mount / quando torna in
// primo piano). Rispondiamo e la consumiamo (freschezza max 60s).
self.addEventListener('message', e => {
  if (e.data?.type !== 'ist-get-pending') return
  const fresh = pendingNav && (Date.now() - pendingNav.at < 60000) ? pendingNav.url : null
  pendingNav = null
  e.source?.postMessage?.({ type: 'ist-navigate', url: fresh })
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
  // Memorizza la destinazione: se il postMessage/openWindow non basta, l'app la
  // recupera con ist-get-pending appena diventa visibile.
  pendingNav = { url, at: Date.now() }
  e.waitUntil((async () => {
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
