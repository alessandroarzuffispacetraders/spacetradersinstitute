# Lancio app nativa (iOS/Android) — runbook IST

L'app nativa è un **guscio Capacitor** attorno alla stessa web app React.
**Backend Supabase invariato**, stesso database, stessi account. Aggiornare la
web app aggiorna anche l'app (dopo `cap sync` / OTA).

Stato: ✅ fondamenta Capacitor installate (`capacitor.config.ts`, deps, script).

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

## 3) Microfono — il motivo del passaggio a nativo
Prima **prova il guscio così com'è**: nel WebView il permesso micro è quello
**nativo dell'app** → dovrebbe chiederlo **una volta sola** e restare permanente.
- Se dopo esci/rientri **non** lo richiede più → 🎉 fatto, niente altro da fare.
- Se lo richiede ancora → si aggiunge un recorder nativo:
  ```bash
  npm i capacitor-voice-recorder
  ```
  e in `src/lib/audioRecorder.ts` si usa il plugin quando
  `Capacitor.isNativePlatform()` (permesso nativo persistente), tenendo
  MediaRecorder per la versione web. (Lo cabliamo insieme quando l'app builda.)

## 4) Notifiche push (nativo)
La web push (VAPID/service worker) **non** funziona nel WebView nativo. Da
migrare a push native quando serve:
```bash
npm i @capacitor/push-notifications
```
Richiede: capability Push su Xcode, chiave APNs sul portale Apple, e adattare
`send-push` per inviare via APNs (oltre/al posto di web push). — Step successivo,
non blocca il primo rilascio (in app le notifiche in-app + realtime funzionano).

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
