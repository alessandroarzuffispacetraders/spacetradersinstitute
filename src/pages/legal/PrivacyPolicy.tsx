// Privacy Policy PUBBLICA (route /privacy, fuori dall'auth) — necessaria per la
// pubblicazione su App Store (campo "Privacy Policy URL"). Auto-contenuta e
// sempre leggibile (colori fissi scuri, non dipende dal tema/provider).
// NB: i dati del Titolare (ragione sociale, indirizzo, email) sono da confermare.
import type { ReactNode } from 'react'

const CONTACT_EMAIL = 'alessandroarzuffi.spacetraders@gmail.com'
const LAST_UPDATE = '4 luglio 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14.5, lineHeight: 1.7, color: '#c2cbd6' }}>{children}</div>
    </section>
  )
}

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#070812', padding: '48px 20px', color: '#c2cbd6' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#7CBBD0', textDecoration: 'none' }}>← Indietro</a>
        <img src="/logo.png" alt="Space Traders Institute" style={{ width: 56, height: 56, marginTop: 20, marginBottom: 20, display: 'block' }} />
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Informativa sulla Privacy
        </h1>
        <p style={{ fontSize: 13, color: '#8b95a3', marginTop: 8 }}>
          Space Traders Institute · Ultimo aggiornamento: {LAST_UPDATE}
        </p>

        <p style={{ fontSize: 14.5, lineHeight: 1.7, marginTop: 22 }}>
          La presente informativa descrive come Orion Trade Dynamics LLC (“noi”, il “Titolare”),
          che gestisce Space Traders Institute, raccoglie e tratta i dati personali degli utenti
          dell'applicazione e della piattaforma web Space Traders Institute (l'“App”), una scuola
          di coaching 1:1 per trader.
        </p>

        <Section title="1. Titolare del trattamento">
          Il Titolare del trattamento è <strong style={{ color: '#dfe5ec' }}>Orion Trade Dynamics LLC</strong>,
          con sede in 30 N Gould St, Ste R, Sheridan, WY 82801, Stati Uniti (EIN 61-2254267), operante
          come “Space Traders Institute”. Per qualsiasi richiesta relativa ai tuoi dati puoi scriverci
          a <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#7CBBD0' }}>{CONTACT_EMAIL}</a>.
        </Section>

        <Section title="2. Dati che raccogliamo">
          <ul style={{ paddingLeft: 20, listStyle: 'disc' }}>
            <li><strong style={{ color: '#dfe5ec' }}>Dati dell'account:</strong> indirizzo email, nome visualizzato e password (conservata in forma cifrata dal nostro fornitore di autenticazione).</li>
            <li><strong style={{ color: '#dfe5ec' }}>Dati del profilo:</strong> immagine del profilo (foto caricata o avatar), ruolo e stato dell'account.</li>
            <li><strong style={{ color: '#dfe5ec' }}>Contenuti generati:</strong> messaggi di chat, messaggi vocali, immagini e file allegati, voci del diario di trading, consegne dei compiti e relativi materiali.</li>
            <li><strong style={{ color: '#dfe5ec' }}>Dati di utilizzo e sicurezza:</strong> registro degli accessi con indirizzo IP, posizione approssimativa (città e paese ricavati dall'IP), tipo di dispositivo e browser, data e ora. Sono usati per la sicurezza dell'account e per rilevare accessi anomali/condivisione di credenziali.</li>
            <li><strong style={{ color: '#dfe5ec' }}>Notifiche push:</strong> un identificativo (token) del dispositivo, necessario per inviarti le notifiche.</li>
            <li><strong style={{ color: '#dfe5ec' }}>Permessi del dispositivo:</strong> microfono (per i messaggi vocali), fotocamera e galleria (per foto e allegati). Sono usati solo quando avvii tu l'azione e solo previo tuo consenso di sistema.</li>
          </ul>
          Non raccogliamo dati di pagamento: nell'App non avvengono transazioni.
        </Section>

        <Section title="3. Finalità e basi giuridiche">
          Trattiamo i dati per: fornire ed erogare il servizio di coaching e le funzionalità dell'App
          (esecuzione del contratto); garantire sicurezza, prevenzione delle frodi e corretto uso
          dell'account (legittimo interesse); inviarti notifiche di servizio (consenso, revocabile
          in qualsiasi momento dalle impostazioni del dispositivo).
        </Section>

        <Section title="4. Come condividiamo i dati">
          Non vendiamo i tuoi dati. Li condividiamo solo con fornitori che erogano il servizio per
          nostro conto:
          <ul style={{ paddingLeft: 20, listStyle: 'disc', marginTop: 8 }}>
            <li><strong style={{ color: '#dfe5ec' }}>Supabase</strong> — hosting del database, autenticazione e archiviazione dei file.</li>
            <li><strong style={{ color: '#dfe5ec' }}>Vimeo</strong> — streaming dei videocorsi.</li>
            <li><strong style={{ color: '#dfe5ec' }}>Apple / Google</strong> — recapito delle notifiche push.</li>
            <li><strong style={{ color: '#dfe5ec' }}>Servizio di geolocalizzazione IP</strong> — per determinare città/paese approssimativi dei log di accesso.</li>
          </ul>
        </Section>

        <Section title="5. Conservazione">
          Conserviamo i dati per il tempo necessario a fornire il servizio. Quando elimini il tuo
          account, l'account e i dati personali collegati vengono rimossi in modo definitivo (vedi
          sezione seguente).
        </Section>

        <Section title="6. I tuoi diritti e la cancellazione dell'account">
          Hai diritto di accedere, rettificare, esportare e cancellare i tuoi dati, e di opporti a
          determinati trattamenti. <strong style={{ color: '#dfe5ec' }}>Puoi eliminare il tuo account
          direttamente dall'App</strong>: apri <em>Profilo → Account → Elimina account</em> e conferma.
          L'operazione rimuove in modo definitivo e irreversibile il tuo account e i dati collegati.
          In alternativa puoi scriverci a <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#7CBBD0' }}>{CONTACT_EMAIL}</a>.
        </Section>

        <Section title="7. Sicurezza">
          Adottiamo misure tecniche e organizzative adeguate (cifratura in transito, controlli di
          accesso a livello di riga sul database, autorizzazioni lato server) per proteggere i tuoi
          dati. Nessun sistema è però sicuro al 100%.
        </Section>

        <Section title="8. Minori">
          L'App è destinata a utenti maggiorenni. Non raccogliamo consapevolmente dati di minori.
        </Section>

        <Section title="9. Modifiche">
          Potremo aggiornare questa informativa; le modifiche saranno pubblicate su questa pagina con
          la data di aggiornamento. Ti invitiamo a consultarla periodicamente.
        </Section>

        <Section title="10. Contatti">
          Per domande o richieste sui tuoi dati: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#7CBBD0' }}>{CONTACT_EMAIL}</a>.
        </Section>

        <p style={{ fontSize: 12, color: '#6b7480', marginTop: 40 }}>© {new Date().getFullYear()} Orion Trade Dynamics LLC — Space Traders Institute. Tutti i diritti riservati.</p>
      </div>
    </div>
  )
}
