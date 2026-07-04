import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import RequireRole from '../components/auth/RequireRole'
import RequireFullAccess from '../components/auth/RequireFullAccess'
import AccessGate from '../components/auth/AccessGate'
import LoginPage from '../pages/auth/LoginPage'
import PrivacyPolicy from '../pages/legal/PrivacyPolicy'

// Student pages
import StudentDashboard from '../pages/student/StudentDashboard'
import StudentPercorso from '../pages/student/StudentPercorso'
import StudentCorsi from '../pages/student/StudentCorsi'
import StudentCategoryDetail from '../pages/student/StudentCategoryDetail'
import StudentLezione from '../pages/student/StudentLezione'
import StudentDiario from '../pages/student/StudentDiario'
import StudentCompiti from '../pages/student/StudentCompiti'
import StudentMentalCoach from '../pages/student/StudentMentalCoach'
import StudentLive from '../pages/student/StudentLive'
import StudentLivePlayer from '../pages/student/StudentLivePlayer'
import StudentCalendario from '../pages/student/StudentCalendario'
import StudentProgressi from '../pages/student/StudentProgressi'
import StudentJournal from '../pages/student/StudentJournal'

// Shared
import ChatPage from '../pages/shared/ChatPage'

// Coach pages
import CoachDashboard from '../pages/coach/CoachDashboard'
import CoachStudenti from '../pages/coach/CoachStudenti'
import CoachReview from '../pages/coach/CoachReview'
import CoachSegnalazioni from '../pages/coach/CoachSegnalazioni'
import CoachLive from '../pages/coach/CoachLive'

// Mental Coach pages
import MentalCoachDashboard from '../pages/mental-coach/MentalCoachDashboard'
import MentalCoachStudenti from '../pages/mental-coach/MentalCoachStudenti'
import MentalCoachSessioni from '../pages/mental-coach/MentalCoachSessioni'
import MentalCoachNote from '../pages/mental-coach/MentalCoachNote'
import MentalCoachLive from '../pages/mental-coach/MentalCoachLive'
import MentalCoachSegnalazioni from '../pages/mental-coach/MentalCoachSegnalazioni'

// Admin pages
import AdminDashboard from '../pages/admin/AdminDashboard'
import AdminUtenti from '../pages/admin/AdminUtenti'
import AdminContenuti from '../pages/admin/AdminContenuti'
import AdminStatistiche from '../pages/admin/AdminStatistiche'
import AdminChat from '../pages/admin/AdminChat'
import AdminSegnalazioni from '../pages/admin/AdminSegnalazioni'
import AdminProgramma from '../pages/admin/AdminProgramma'

function PrivateRoutes() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  const defaultPath = {
    student: '/student',
    coach: '/coach',
    mental_coach: '/mental-coach',
    admin: '/admin',
  }[user.role]

  return (
    <Routes>
      <Route element={<AccessGate />}>
      <Route element={<AppLayout />}>
        {/* Student — aperte anche all'utente gratuito */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/corsi" element={<StudentCorsi />} />
        {/* NOTE: /lezione/:id must come before /:categoryId so static "lezione" wins */}
        <Route path="/student/corsi/lezione/:lessonId" element={<StudentLezione />} />
        <Route path="/student/corsi/:categoryId" element={<StudentCategoryDetail />} />
        <Route path="/student/chat" element={<ChatPage />} />
        <Route path="/student/progressi" element={<StudentProgressi />} />

        {/* Student — riservate ai paganti: l'utente gratuito vede l'upsell */}
        <Route element={<RequireFullAccess />}>
          <Route path="/student/percorso" element={<StudentPercorso />} />
          <Route path="/student/diario" element={<StudentDiario />} />
          <Route path="/student/compiti" element={<StudentCompiti />} />
          <Route path="/student/mental-coach" element={<StudentMentalCoach />} />
          <Route path="/student/live" element={<StudentLive />} />
          <Route path="/student/live/:liveId" element={<StudentLivePlayer />} />
          <Route path="/student/calendario" element={<StudentCalendario />} />
          <Route path="/student/journal" element={<StudentJournal />} />
        </Route>

        {/* Coach — solo ruolo coach */}
        <Route element={<RequireRole roles={['coach']} />}>
          <Route path="/coach" element={<CoachDashboard />} />
          <Route path="/coach/studenti" element={<CoachStudenti />} />
          <Route path="/coach/review" element={<CoachReview />} />
          <Route path="/coach/live" element={<CoachLive />} />
          <Route path="/coach/segnalazioni" element={<CoachSegnalazioni />} />
          <Route path="/coach/chat" element={<ChatPage />} />
        </Route>

        {/* Mental Coach — solo ruolo mental_coach */}
        <Route element={<RequireRole roles={['mental_coach']} />}>
          <Route path="/mental-coach" element={<MentalCoachDashboard />} />
          <Route path="/mental-coach/studenti" element={<MentalCoachStudenti />} />
          <Route path="/mental-coach/sessioni" element={<MentalCoachSessioni />} />
          <Route path="/mental-coach/live" element={<MentalCoachLive />} />
          <Route path="/mental-coach/note" element={<MentalCoachNote />} />
          <Route path="/mental-coach/segnalazioni" element={<MentalCoachSegnalazioni />} />
          <Route path="/mental-coach/chat" element={<ChatPage />} />
        </Route>

        {/* Admin — solo ruolo admin */}
        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/utenti" element={<AdminUtenti />} />
          <Route path="/admin/contenuti" element={<AdminContenuti />} />
          <Route path="/admin/programma" element={<AdminProgramma />} />
          <Route path="/admin/statistiche" element={<AdminStatistiche />} />
          <Route path="/admin/segnalazioni" element={<AdminSegnalazioni />} />
          <Route path="/admin/chat" element={<AdminChat />} />
        </Route>

        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Route>
      </Route>
    </Routes>
  )
}

export default function AppRouter() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070812' }}>
        <div className="w-8 h-8 rounded-full border-2 border-ist-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Pagina pubblica (accessibile senza login) — richiesta da App Store */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route path="/*" element={<PrivateRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}
