import { createContext, useContext, ReactNode } from 'react'

// Modalità ANTEPRIMA (esca per l'utente gratuito).
//
// Quando true, gli hook dati delle pagine (usePath, useStudentAssignments,
// useLiveEvents, useDiaryEntries, useMental*, useStudentSessions) restituiscono
// dati FINTI e NON eseguono alcuna query al database. Così l'anteprima riusa le
// STESSE pagine reali (quindi resta sempre identica e si aggiorna da sola quando
// aggiorni le pagine vere), ma senza mai toccare contenuti reali: chi "buca" il
// front-end trova solo dati inventati. Il gating vero resta server-side (RLS).
const PreviewContext = createContext(false)

export function PreviewProvider({ children }: { children: ReactNode }) {
  return <PreviewContext.Provider value={true}>{children}</PreviewContext.Provider>
}

export function useIsPreview(): boolean {
  return useContext(PreviewContext)
}
