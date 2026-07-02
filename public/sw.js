self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'IST', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Raggruppa le notifiche dello stesso canale così non si accumulano.
      tag: data.channel_id || undefined,
      data: data.url ? { url: data.url } : undefined,
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url
  if (!url) return
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
