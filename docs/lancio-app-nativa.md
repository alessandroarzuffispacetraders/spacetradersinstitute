# Lancio app nativa (iOS/Android) — runbook IST

L'app nativa è un **guscio Capacitor** attorno alla stessa web app React.
**Backend Supabase invariato**, stesso database, stessi account. Aggiornare la
web app aggiorna anche l'app (dopo `cap sync` / OTA).

Stato: ✅ progetto iOS generato (`ios/`, Swift Package Manager — **niente CocoaPods**),
gira su simulatore. ✅ **microfono nativo** (permesso chiesto una volta sola). ✅ **icona**
= logo IST. ✅ **splash screen** = logo su sfondo brand. ✅ **banner "scarica l'app"** sul web.
✅ **push native APNs**: tutto il codice pronto (client + DB + `send-push`), manca solo la
**chiave APNs** dall'account Apple (vedi §4). ⏳ account Apple Developer in approvazione.

---

## 0) Prerequisiti (una tantum)

| Cosa | Dove | Costo |
|---|---|---|
| **Apple Developer Program** | developer.apple.com | **99 $/anno** |
| **Xcode** (non bastano i Command Line Tools) | Mac App Store (~10-15 GB) | gratis |
| **CocoaPods** | `sudo gem install cocoapods` | gratis |
| (Android) **Google Play Console** | play.google.com/console | 25 $ una tantum |
| (Android) **Android Studio** | developer.android.com | gratis |

Dopo aver installato Xcode:
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version   # deve stampare la versione
sudo gem install cocoapods
```

---

## 1) Aggiungere le piattaforme
```bash
npm run build
npx cap add ios
npx cap add android      # opzionale, per il Play Store
npx cap sync
```
I progetti `ios/` e `android/` vengono creati e si **committano** (gli artefatti
di build sono già in `.gitignore`).

---

## 2) Configurazione iOS (in Xcode: `npx cap open ios`)
- **Signing & Capabilities** → seleziona il tuo team Apple Developer.
- **Display name**: "Space Traders Institute" (o "IST").
- **Bundle Identifier**: `com.spacetradersinstitute.app` (già in config).
- **Info.plist** → aggiungi la descrizione permesso microfono:
  - `NSMicrophoneUsageDescription` = "Per registrare messaggi vocali nelle chat."
- **Icona**: usa `public/icon-512.png` (Assets.xcassets → AppIcon).

## 3) Microfono — ✅ FATTO
Nel WebView nativo il permesso microfono è quello **nativo dell'app**: viene
chiesto **una volta sola** e resta permanente (era il motivo del passaggio a
nativo). Confermato funzionante sul simulatore → **niente recorder nativo**,
`MediaRecorder` va bene anche dentro l'app.

## 4) Notifiche push native (APNs) — codice PRONTO, manca solo la chiave Apple
La web push (VAPID/service worker) **non** funziona nel WebView nativo, quindi
l'app usa **APNs** via `@capacitor/push-notifications`. **Tutto il codice è già
scritto** e no-op finché non lo attivi:
- Client: `src/lib/nativePush.ts` + `NativePushBridge` in `AppLayout` (chiede il
  permesso, registra il device token, e al tap sulla notifica naviga al deep-link).
- DB: migration `phase_native_push.sql` (applicata) — colonne `platform`/`native_token`
  su `push_subscriptions` + RPC `register_native_push_subscription`.
- Server: `supabase/functions/send-push/apns.ts` invia via APNs (firma JWT ES256);
  `index.ts` instrada web→WebPush e native→APNs dalla stessa lista destinatari.
- iOS: `AppDelegate.swift` inoltra già il device token ai listener Capacitor.

**Per ATTIVARle (quando l'account Apple Developer è approvato):**
1. **Xcode** → target App → *Signing & Capabilities* → **+ Capability** →
   **Push Notifications**. (Richiede l'account a pagamento; con l'Apple ID gratuito
   NON si può → per ora l'app builda ma la registrazione fallisce silenziosamente,
   è previsto.)
2. Portale Apple → *Certificates, Identifiers & Profiles* → **Keys** → crea una
   **APNs Auth Key** (.p8). Segna **Key ID** e **Team ID**. Scarica il `.p8` (una volta sola).
3. Imposta i secret della edge function e ridistribuiscila:
   ```bash
   supabase secrets set APNS_KEY_ID=XXXXXXXXXX
   supabase secrets set APNS_TEAM_ID=YYYYYYYYYY
   supabase secrets set APNS_BUNDLE_ID=com.spacetradersinstitute.app
   supabase secrets set APNS_AUTH_KEY="$(cat ~/Downloads/AuthKey_XXXXXXXXXX.p8)"
   supabase secrets set APNS_PRODUCTION=false   # false = build da Xcode (sandbox);
                                                 # true  = TestFlight / App Store
   supabase functions deploy send-push --use-api
   ```
4. Run su iPhone → concedi le notifiche → il device token viene salvato. Test:
   manda un messaggio da un altro account → arriva la push nativa.

⚠️ `APNS_PRODUCTION`: i token di una build fatta da Xcode valgono solo su **sandbox**
(`false`); quelli di TestFlight/App Store solo su **produzione** (`true`). Se le push
non arrivano, quasi sempre è questo il flag sbagliato.

## 5) Provare su iPhone + TestFlight
```bash
npm run cap:ios      # build + sync + apre Xcode
```
- Collega l'iPhone, Run ▶ per provarla sul dispositivo.
- Per i tester: Xcode → Product → Archive → distribuisci su **TestFlight**.

## 6) Pubblicazione App Store
- App Store Connect → nuova app (stesso bundle id) → schede, screenshot, privacy.
- **Nota revisione (linea guida 4.2)**: Apple può rifiutare app che sono "solo un
  sito". Le funzioni native (microfono, push, eventuale login biometrico) sono la
  giustificazione: evidenziarle nella descrizione/note per il revisore.
- Invia per revisione → 1-3 giorni → live.

## 7) Aggiornamenti
- Modifiche di **codice web** → `npm run cap:sync` e ridistribuisci **oppure** OTA
  (es. Capgo/Appflow) per aggiornare i JS senza ripassare dalla revisione.
- Modifiche **native** (permessi, plugin, icona) → nuova build + revisione Apple.

---

## Ordine consigliato
1. Apple Developer account (parte subito, l'approvazione può richiedere 1-2 gg).
2. Installa Xcode + CocoaPods.
3. `cap add ios` → gira su iPhone → **testa il microfono** (punto 3).
4. Se serve, recorder nativo. Poi TestFlight → App Store.
5. Android in parallelo/dopo (facoltativo).
