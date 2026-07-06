// Pagina pubblica di RICHIESTA ELIMINAZIONE ACCOUNT (route /account-deletion, fuori
// dall'auth) — richiesta da Google Play (campo "Eliminazione dell'account") e utile
// anche per App Store. Deve essere raggiungibile SENZA login: spiega sia la via in-app
// sia quella via email per chi non riesce ad accedere. Auto-contenuta.

const SUPPORT_EMAIL = 'alessandroarzuffi.spacetraders@gmail.com'

export default function AccountDeletion() {
  return (
    <div style={{ minHeight: '100vh', background: '#070812', padding: '48px 20px', color: '#c2cbd6' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#7CBBD0', textDecoration: 'none' }}>← Indietro</a>
        <img src="/logo.png" alt="Space Traders Institute" style={{ width: 56, height: 56, marginTop: 20, marginBottom: 20, display: 'block' }} />
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Eliminazione dell'account
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, marginTop: 16 }}>
          Puoi eliminare in qualsiasi momento il tuo account Space Traders Institute e i dati
          collegati. Hai due modi.
        </p>

        {/* Via 1: in-app */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginTop: 34 }}>
          1. Dall'app (immediato)
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
          Accedi all'app e vai su <strong>Profilo → Account → Elimina account</strong>. Conferma
          digitando <strong>ELIMINA</strong>. L'account e i dati collegati vengono rimossi in modo
          <strong> definitivo e immediato</strong>.
        </p>

        {/* Via 2: email */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginTop: 30 }}>
          2. Via email (se non riesci ad accedere)
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
          Scrivi a{' '}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Richiesta%20eliminazione%20account`} style={{ color: '#7CBBD0' }}>
            {SUPPORT_EMAIL}
          </a>{' '}
          dall'indirizzo email associato al tuo account, con oggetto{' '}
          <em>"Richiesta eliminazione account"</em>. Elaboreremo la richiesta e cancelleremo
          l'account entro <strong>30 giorni</strong>.
        </p>

        {/* Cosa viene eliminato */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginTop: 34 }}>
          Quali dati vengono eliminati
        </h2>
        <ul style={{ fontSize: 14, lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
          <li>Account e profilo (nome, email)</li>
          <li>Messaggi e allegati inviati nella chat e nei messaggi privati</li>
          <li>Voci del diario di trading</li>
          <li>Progressi, badge e avanzamento del percorso</li>
          <li>Token per le notifiche push del tuo dispositivo</li>
        </ul>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
          L'eliminazione è definitiva e non reversibile. Alcuni log tecnici minimi possono essere
          conservati solo per il tempo e nei limiti eventualmente richiesti dalla legge, senza
          identificare più il tuo account.
        </p>

        <p style={{ fontSize: 13, marginTop: 34 }}>
          Consulta anche la nostra <a href="/privacy" style={{ color: '#7CBBD0' }}>Informativa sulla Privacy</a>{' '}
          e la pagina di <a href="/support" style={{ color: '#7CBBD0' }}>Supporto</a>.
        </p>

        <p style={{ fontSize: 12, color: '#6b7480', marginTop: 32 }}>
          © {new Date().getFullYear()} Orion Trade Dynamics LLC — Space Traders Institute.
        </p>
      </div>
    </div>
  )
}
