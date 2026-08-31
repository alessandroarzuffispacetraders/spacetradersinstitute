import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // lucide-react esporta ~1000 file, uno per icona: la scansione di dipendenze
  // di Vite li attraversa tutti uno per uno al primo avvio, rendendolo
  // lentissimo (o apparentemente bloccato) su filesystem/macchine più lente.
  // Escluderlo dalla pre-ottimizzazione lo fa servire come ESM nativo.
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
})
