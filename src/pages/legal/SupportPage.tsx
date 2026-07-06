// Pagina di SUPPORTO pubblica (route /support, fuori dall'auth) — necessaria per
// la pubblicazione su App Store (campo "Support URL"). Auto-contenuta e sempre
// leggibile. NB: l'email di supporto è da confermare.

const SUPPORT_EMAIL = 'alessandroarzuffi.spacetraders@gmail.com'

function Faq({ q, children }: { q: string; children: string }) {
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>{q}</p>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: '#c2cbd6' }}>{children}</p>
    </div>
  )
}

export default function SupportPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#070812', padding: '48px 20px', color: '#c2cbd6' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#7CBBD0', textDecoration: 'none' }}>← Indietro</a>
        <img src="/logo.png" alt="Space Traders Institute" style={{ width: 56, height: 56, marginTop: 20, marginBottom: 20, display: 'block' }} />
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>Supporto</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, marginTop: 16 }}>
          Hai bisogno di aiuto con Space Traders Institute? Scrivici e ti risponderemo il prima
          possibile.
        </p>

        <div
          style={{ marginTop: 22, padding: '18px 20px', borderRadius: 18, background: 'rgba(90,154,177,0.10)', border: '1px solid rgba(90,154,177,0.22)' }}
        >
          <p style={{ fontSize: 13, color: '#8b95a3', marginBottom: 4 }}>Contatto</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ fontSize: 17, fontWeight: 700, color: '#7CBBD0', textDecoration: 'none' }}>
            {SUPPORT_EMAIL}
          </a>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginTop: 34 }}>Domande frequenti</h2>

        <Faq q="Come accedo al mio account?">
          Apri l'app e accedi con l'email e la password che hai usato in fase di registrazione. Se
          hai dimenticato la password, contattaci all'indirizzo qui sopra.
        </Faq>
        <Faq q="Come accedo al percorso di coaching?">
          Il percorso di coaching 1:1 è riservato agli iscritti. Se sei già iscritto, accedi
          con le tue credenziali; per informazioni sull'iscrizione scrivici all'indirizzo qui sopra.
        </Faq>
        <Faq q="Come elimino il mio account?">
          Dall'app: Profilo → Account → Elimina account, quindi conferma. L'account e i dati
          collegati verranno rimossi in modo definitivo.
        </Faq>
        <Faq q="Non ricevo le notifiche">
          Assicurati di aver concesso il permesso notifiche in Impostazioni → Space Traders
          Institute → Notifiche. Puoi verificarne lo stato anche in Profilo → Notifiche.
        </Faq>

        <p style={{ fontSize: 13, marginTop: 34 }}>
          Consulta anche la nostra <a href="/privacy" style={{ color: '#7CBBD0' }}>Informativa sulla Privacy</a>.
        </p>

        <p style={{ fontSize: 12, color: '#6b7480', marginTop: 32 }}>© {new Date().getFullYear()} Orion Trade Dynamics LLC — Space Traders Institute.</p>
      </div>
    </div>
  )
}
