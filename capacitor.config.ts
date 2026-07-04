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
      // Lo splash resta finché la web app è pronta e chiama SplashScreen.hide()
      // (in nativeUi.ts) → niente flash di webview grezzo. Sfondo = dark brand.
      launchAutoHide: false,
      backgroundColor: '#070812',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      // Fade dello splash del plugin (Android); su iOS il fade lo passa hide()
      launchFadeOutDuration: 250,
    },
  },
}

export default config
