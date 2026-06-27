import webPush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

webPush.setVapidDetails(
  'mailto:admin@innerspacetrad.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { message } = await req.json() as {
      message: {
        channel_id: string
        user_id: string
        author_name: string
        content: string
      }
    }

    // Determina a chi mandare la notifica
    let userFilter = `user_id=neq.${message.user_id}`

    // Per DM (channel_id: "dm_uid1_uid2"), notifica solo l'altro utente
    if (message.channel_id.startsWith('dm_')) {
      const parts = message.channel_id.replace('dm_', '').split('_')
      const recipient = parts.find((id: string) => id !== message.user_id)
      if (recipient) userFilter = `user_id=eq.${recipient}`
    }

    // Recupera le subscription di tutti i destinatari
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?${userFilter}&select=endpoint,keys`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
    const subscriptions: { endpoint: string; keys: Record<string, string> }[] = await res.json()

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const body = message.content.length > 100 ? message.content.slice(0, 100) + '…' : message.content

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webPush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title: message.author_name, body, channel_id: message.channel_id }),
        )
      ),
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length

    // Rimuovi gli endpoint morti (410 Gone / 404) così non restano duplicati
    const dead = results
      .map((r, i) => (r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0) ? subscriptions[i].endpoint : null))
      .filter((e): e is string => e !== null)

    if (dead.length > 0) {
      await Promise.all(dead.map((endpoint) =>
        fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }).catch(() => {/* ignora */})
      ))
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-push error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
