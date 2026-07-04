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
}

export default config
