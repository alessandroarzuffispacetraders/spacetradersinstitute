# Release iPhone 1.0.4 (build 8) — istruzioni per l'altro Mac

Per chi esegue (Claude Code o una persona) sul Mac dove Xcode è già configurato con l'account Apple. Scritto il 15/11/2026.

## Obiettivo

Caricare su App Store Connect la build iPhone **1.0.4 (8)** di Space Traders Institute, pronta da inviare in revisione. Non serve fare altro.

## Già fatto (non rifarlo)

- Il codice è tutto su `main` su GitHub, dal commit `8c44a4a` ("App iPhone: versione 1.0.4 (build 8)") in poi.
- La versione è già impostata nel progetto Xcode: `MARKETING_VERSION = 1.0.4`, `CURRENT_PROJECT_VERSION = 8`.
- Il sito web è già pubblicato (Vercel) e il database è già aggiornato.
- Una compilazione iOS di prova (Release, senza firma) è già riuscita sull'altro Mac.

## Regole

- Non modificare il codice dell'app (`src/`). Non toccare Supabase: niente migrazioni, niente edge function.
- **Ogni push su `main` ripubblica il sito in produzione (Vercel).** Non fare push. Unica eccezione: l'aumento del numero di build (vedi "Problemi comuni"), e solo dopo averlo detto all'utente.
- Niente `git push --force`, niente reset delle modifiche locali senza chiedere.

## Dati del progetto

- App Capacitor 8. Il progetto iOS è in `ios/App` e usa Swift Package Manager: **niente CocoaPods**, non serve `pod install`.
- Bundle ID `com.spacetradersinstitute.app`, team `426CD97534`, firma automatica.
- La web app compilata (`dist/`) viene copiata in `ios/App/App/public` da `npx cap sync ios`.

## 1. Controlli prima di iniziare

| Cosa | Come verificarlo | Se manca |
|---|---|---|
| Xcode 26 o successivo (Apple chiede l'SDK iOS 26) | `xcodebuild -version` | Aggiornare Xcode. Se il comando risponde "requires Xcode", usare `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` |
| Account Apple in Xcode | Xcode → Impostazioni → Account: Apple ID con il team "Alessandro Arzuffi" (426CD97534) | Accedere con l'Apple ID dell'account sviluppatore |
| Piattaforma iOS installata | Xcode → Impostazioni → Components: "iOS 26.x" installato | Installarla da lì (circa 8,5 GB) o con `xcodebuild -downloadPlatform iOS` |
| Spazio su disco | `df -h /`: almeno 15 GB liberi | Liberare spazio prima di continuare |
| Node 20 o successivo | `node -v` | Installare Node |
| File `.env.local` nella cartella del progetto | `ls -a` nella cartella del progetto | Vedi sotto |

`.env.local` **non è su GitHub**. Deve contenere `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (obbligatorie) più `VITE_SITE_URL`, `VITE_IOS_APP_URL`, `VITE_JOURNAL_URL`, `VITE_SUPPORT_URL` e `VITE_VAPID_PUBLIC_KEY`. Senza questo file l'app non si collega al database. Se manca, fermati e chiedilo all'utente: lo può copiare dalla cartella `ist-app` dell'altro Mac. Non inventare i valori.

## 2. Aggiornare il codice

```bash
cd <cartella del progetto>
git status            # deve essere pulito; se ci sono modifiche locali, chiedi all'utente prima di continuare
git checkout main
git pull
git log --oneline -3  # deve comparire 8c44a4a (o commit successivi)
```

Se su questo Mac il progetto non c'è:

```bash
git clone https://github.com/alessandroarzuffispacetraders/spacetradersinstitute.git ist-app
```

Poi copia dentro `.env.local`.

## 3. Build web e sincronizzazione iOS

```bash
npm ci                # oppure npm install
npm run build         # tsc + vite build: deve finire senza errori
npx cap sync ios
grep -E "MARKETING_VERSION|CURRENT_PROJECT_VERSION" ios/App/App.xcodeproj/project.pbxproj
# deve mostrare 1.0.4 e 8
```

## 4. Archivio e caricamento

### Opzione A: da Xcode (più semplice)

1. Esegui `npx cap open ios`.
2. In alto, come destinazione scegli **Any iOS Device (arm64)**.
3. Menu **Product → Archive**.
4. Nella finestra Organizer: **Distribute App → App Store Connect → Upload**. Lascia le opzioni predefinite (firma automatica) e conferma.

### Opzione B: da terminale

I file di lavoro vanno fuori dal progetto, così non finiscono su git.

```bash
OUT=~/ist-ios-build && mkdir -p "$OUT"
cat > "$OUT/ExportOptions.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>426CD97534</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
EOF

xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$OUT/IST-1.0.4-8.xcarchive" \
  -allowProvisioningUpdates archive

xcodebuild -exportArchive -archivePath "$OUT/IST-1.0.4-8.xcarchive" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/export" -allowProvisioningUpdates
```

Il caricamento è riuscito se compaiono `** EXPORT SUCCEEDED **` e il messaggio di upload completato.

## 5. Problemi comuni

- **"iOS 26.x is not installed"**: installa la piattaforma iOS (punto 1).
- **"No Accounts", "No profiles for 'com.spacetradersinstitute.app'" o "No signing certificate"**: l'account Apple non è in Xcode, oppure manca un ruolo con permessi di distribuzione. Accedi in Xcode. Con `-allowProvisioningUpdates`, o con la firma automatica da GUI, Xcode crea da solo certificato e profilo.
- **Errori che chiedono di caricare un plug-in, o "run xcodebuild -runFirstLaunch"**: esegui `xcodebuild -runFirstLaunch` e riprova.
- **Caricamento rifiutato perché il numero di build è già usato o troppo basso**: porta la build a 9 e rifai il punto 4.
  ```bash
  sed -i '' 's/CURRENT_PROJECT_VERSION = 8;/CURRENT_PROJECT_VERSION = 9;/g' ios/App/App.xcodeproj/project.pbxproj
  ```
  Poi fai un commit ("App iPhone: build 9") e avvisa l'utente. Il push solo con il suo OK, perché ripubblica il sito: il codice è identico, quindi non fa danni.
- **Notifiche push**: `App.entitlements` contiene `aps-environment = development`. È corretto: nell'esportazione per App Store, Xcode lo passa a production da solo. Non modificarlo.

## 6. Dopo il caricamento (lo fa l'utente in App Store Connect)

1. Aspetta che Apple elabori la build: di solito 15–30 minuti, poi arriva un'email.
2. Vai in App Store Connect → App → Space Traders Institute.
   - Se la versione 1.0.4 non esiste, creala con il **+** accanto a "App iOS".
   - Se c'è una versione non ancora approvata (per esempio 1.0.3), puoi rinominarla in 1.0.4.
3. Nella sezione **Build**, scegli **1.0.4 (8)** (oppure 9, se l'hai alzata).
4. Compila **"Novità di questa versione"**. Testo proposto:
   > Nuova versione con un design completamente rinnovato.
   > • Home ridisegnata, con le live e i video da riprendere subito
   > • Percorso interattivo che segue i tuoi progressi passo dopo passo
   > • Videocorsi e live con nuove copertine
   > • Chat rinnovata: il tuo coach può inviarti direttamente i video del percorso
   > • Calendario con le sessioni da aggiungere al tuo calendario
   > • Navigazione più semplice e veloce
5. Controlla **"Informazioni per la revisione dell'app"**: ci deve essere un account demo con accesso **attivo**. Se il revisore non riesce a entrare, Apple rifiuta l'app.
6. Conformità all'esportazione: è già dichiarata nell'app (`ITSAppUsesNonExemptEncryption = false`), quindi Apple non fa domande.
7. Premi **Aggiungi per la revisione**, poi **Invia**. La revisione richiede di solito 1–3 giorni.

## Cosa riferire all'utente alla fine

- Versione e build caricate (1.0.4 e 8, oppure 9).
- Se hai cambiato qualcosa nel progetto, e se c'è un commit da pushare.
- Eventuali errori, con il messaggio esatto.
