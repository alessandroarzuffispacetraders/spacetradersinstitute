import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Compass, Eye, FileText } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOnboarding, QUESTIONNAIRE_URL } from '../../lib/onboarding'
import { startPlatformTour } from '../../lib/tour'
import VimeoPlayer from '../ui/VimeoPlayer'

function StepShell({ n, title, done, children }: {
  n: number; title: string; done: boolean; children?: React.ReactNode
}) {
  return (
    <div className="flex gap-3.5">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
        style={done
          ? { background: 'rgba(70,211,154,0.16)', color: '#46D39A', border: '1px solid rgba(70,211,154,0.28)' }
          : { background: 'var(--ist-w8)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w10)' }}
      >
        {done ? <CheckCircle2 size={15} strokeWidth={2.5} /> : n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-1.5" style={{ color: done ? 'var(--ist-text-muted)' : 'var(--ist-text)' }}>
          {title}
        </p>
        {!done && children}
      </div>
    </div>
  )
}

const primaryBtn = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full text-white transition-all hover:-translate-y-0.5'
const primaryBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', border: '1px solid var(--ist-w14)',
}

export default function OnboardingCard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const ob = useOnboarding(user?.id ?? '')

  if (user?.role !== 'student' || ob.loading || ob.allDone) return null

  const hasWelcome = !!ob.welcome
  let n = 0

  return (
    <div
      className="rounded-3xl p-5 lg:p-6"
      style={{
        background: 'var(--ist-card-bg-premium, var(--ist-card-bg))',
        border: '1px solid var(--ist-border)',
        boxShadow: 'var(--ist-card-shadow-premium, var(--ist-card-shadow))',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Compass size={17} strokeWidth={2} style={{ color: 'var(--ist-accent-text)' }} />
        <h2 className="text-base font-bold" style={{ color: 'var(--ist-text)' }}>Primi passi</h2>
      </div>
      <p className="text-xs mb-5" style={{ color: 'var(--ist-text-dim)' }}>
        Completa questi passaggi per iniziare il tuo percorso.
      </p>

      <div className="space-y-5">
        {/* 1) Video di benvenuto (solo se configurato) */}
        {hasWelcome && (
          <StepShell n={++n} title="Guarda il video di benvenuto" done={ob.welcomeSeen}>
            <div className="rounded-2xl overflow-hidden mb-3">
              <VimeoPlayer vimeoId={ob.welcome!.vimeoId} accent="#5A9AB1" />
            </div>
            <button className={primaryBtn} style={primaryBtnStyle} onClick={() => ob.markWelcomeSeen()}>
              <Eye size={15} strokeWidth={2} /> Segna come visto
            </button>
          </StepShell>
        )}

        {/* 2) Questionario */}
        <StepShell n={++n} title="Compila il questionario di onboarding" done={ob.questionnaireDone}>
          <div className="flex flex-wrap items-center gap-3">
            <a
              className={primaryBtn}
              style={primaryBtnStyle}
              href={QUESTIONNAIRE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText size={15} strokeWidth={2} /> Apri il questionario
              <ExternalLink size={13} strokeWidth={2} />
            </a>
            <button
              className="text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--ist-accent-text)' }}
              onClick={() => ob.setQuestionnaire(true)}
            >
              L'ho compilato
            </button>
          </div>
        </StepShell>

        {/* 3) Tour della piattaforma */}
        <StepShell n={++n} title="Fai il tour della piattaforma" done={ob.tutorialDone}>
          <button
            className={primaryBtn}
            style={primaryBtnStyle}
            onClick={() => startPlatformTour(() => ob.markTutorialDone())}
          >
            <Compass size={15} strokeWidth={2} /> Avvia il tour
          </button>
        </StepShell>
      </div>

      {/* Scorciatoie post-completamento parziale */}
      {ob.welcomeSeen && hasWelcome && (
        <button
          className="text-xs font-medium mt-5 transition-opacity hover:opacity-70"
          style={{ color: 'var(--ist-text-dim)' }}
          onClick={() => navigate(`/student/corsi/lezione/${ob.welcome!.id}`)}
        >
          Rivedi il video di benvenuto nel videocorso →
        </button>
      )}
    </div>
  )
}
