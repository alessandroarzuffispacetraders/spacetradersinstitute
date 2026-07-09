import type { CapacitorConfig } from '@capacitor/cli'

// Guscio nativo (iOS/Android) attorno alla stessa web app: carica il build
// Vite da `dist`. Il backend (Supabase) resta identico — nessuna migrazione.
const config: CapacitorConfig = {
  appId: 'com.spacetradersinstitute.app',
  appName: 'Space Traders Institute',
  webDir: 'dist',
  ios: {
    // La web app gestisce già le safe-area via env() e VisualViewport.
    contentInset: 'never',
    backgroundColor: '#070812',
  },
  android: {
    backgroundColor: '#070812',
  },
  plugins: {
    SplashScreen: {
      // Di norma lo splash lo nasconde la web app appena pronta, chiamando
      // SplashScreen.hide() (in nativeUi.ts) → niente flash di webview grezzo.
      //
      // MA con launchAutoHide:false, se su un device reale quel percorso si
      // impianta (boot lento, hide() senza effetto), lo splash resta PER SEMPRE:
      // è la causa dello "splash infinito" segnalato dai tester Android in 1.0.10.
      // Rete di sicurezza NATIVA: launchAutoHide:true + launchShowDuration → lo
      // splash si dissolve comunque da solo dopo N ms anche se il JS non chiama
      // hide(). Sul boot normale hide() lo toglie prima, quindi nessun ritardo.
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#070812',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      // Fade dello splash del plugin (Android); su iOS il fade lo passa hide()
      launchFadeOutDuration: 250,
    },
    Keyboard: {
      // 'none': il webview NON si ridimensiona con la tastiera → resta a schermo
      // pieno (dipinto dalla web app, niente sfondo nativo che spunta) e la barra
      // di scrittura viene posizionata via VisualViewport/CSS (useVisibleViewport),
      // estendendo il proprio colore dietro la tastiera → niente striscia scura.
      resize: 'none',
    },
  },
}

export default config
