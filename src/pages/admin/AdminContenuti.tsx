import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import {
  ChevronDown, Plus, Edit2, Trash2,
  Paperclip, Video, FolderOpen, BookOpen, Radio, Clock,
  ChevronUp, Eye, EyeOff, Loader2, X, Upload,
} from 'lucide-react'
import {
  useContentAdmin, Category, Course, Lesson,
  CategoryInput, CourseInput, LessonInput,
} from '../../lib/content'
import { parseVimeo } from '../../lib/vimeo'
import { uploadAttachment, deleteAttachment } from '../../lib/storage'
import { useLiveAdmin, LiveEvent, LiveInput, LiveStatus, LiveRole, liveDateLabel, liveDurationLabel } from '../../lib/live'

type Tab = 'corsi' | 'live'
type ExpandState = { categories: Set<string>; courses: Set<string> }

type AdminApi = ReturnType<typeof useContentAdmin>

// Modal descriptor for the create/edit editor.
type ModalState =
  | { kind: 'category'; mode: 'create' }
  | { kind: 'category'; mode: 'edit'; id: string; entity: Category }
  | { kind: 'course'; mode: 'create'; parentId: string }
  | { kind: 'course'; mode: 'edit'; id: string; entity: Course }
  | { kind: 'lesson'; mode: 'create'; parentId: string }
  | { kind: 'lesson'; mode: 'edit'; id: string; entity: Lesson }

const PHASES = ['Onboarding', 'Build', 'Test', 'Deploy']
const ACCENTS = ['#7CBBD0', '#46D39A', '#F6C85F', '#A078FF', '#FF6B7A', '#5A9AB1']

const inputStyle: React.CSSProperties = {
  background: 'var(--ist-w7)',
  border: '1px solid var(--ist-w10)',
  borderRadius: 14,
  color: 'var(--ist-text)',
  outline: 'none',
  width: '100%',
}

const PHASE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Onboarding: { bg: 'rgba(124,187,208,0.12)', text: '#7CBBD0',  border: 'rgba(124,187,208,0.22)' },
  Build:      { bg: 'rgba(70,211,154,0.12)',  text: '#46D39A',  border: 'rgba(70,211,154,0.22)'  },
  Test:       { bg: 'rgba(246,200,95,0.12)',  text: '#F6C85F',  border: 'rgba(246,200,95,0.22)'  },
  Deploy:     { bg: 'rgba(160,120,255,0.12)', text: '#A078FF',  border: 'rgba(160,120,255,0.22)' },
}

function PhaseBadge({ phase }: { phase: string }) {
  const s = PHASE_STYLE[phase] ?? PHASE_STYLE.Build
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {phase}
    </span>
  )
}

function PublishedBadge({ published }: { published: boolean }) {
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={published
        ? { background: 'rgba(70,211,154,0.12)', color: '#46D39A', border: '1px solid rgba(70,211,154,0.22)' }
        : { background: 'var(--ist-w6)', color: 'var(--ist-text-dim)', border: '1px solid var(--ist-border)' }
      }
    >
      {published ? 'Pubblicato' : 'Bozza'}
    </span>
  )
}

function ActionBtn({ icon, label, danger, onClick, disabled }: {
  icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-white/[0.04] disabled:opacity-30"
      style={{ color: danger ? 'rgba(255,107,122,0.70)' : 'var(--ist-text-dim)' }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// Up/down reorder control.
function MoveBtns({ onUp, onDown, isFirst, isLast }: {
  onUp: () => void; onDown: () => void; isFirst: boolean; isLast: boolean
}) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <button
        onClick={onUp} disabled={isFirst}
        className="w-5 h-4 flex items-center justify-center rounded transition-colors hover:bg-white/[0.06] disabled:opacity-20"
        style={{ color: 'var(--ist-text-dim)' }}
        title="Sposta su"
      >
        <ChevronUp size={12} strokeWidth={2.5} />
      </button>
      <button
        onClick={onDown} disabled={isLast}
        className="w-5 h-4 flex items-center justify-center rounded transition-colors hover:bg-white/[0.06] disabled:opacity-20"
        style={{ color: 'var(--ist-text-dim)' }}
        title="Sposta giù"
      >
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function findAdminLesson(cats: Category[], id: string): Lesson | null {
  for (const c of cats) {
    for (const cr of c.courses) {
      const l = cr.lessons.find(x => x.id === id)
      if (l) return l
    }
  }
  return null
}

// ─── Editor modal ─────────────────────────────────────────────────────────────

function EditorModal({ state, admin, onClose }: {
  state: ModalState; admin: AdminApi; onClose: () => void
}) {
  const isCategory = state.kind === 'category'
  const isCourse   = state.kind === 'course'
  const isLesson   = state.kind === 'lesson'
  const entity = 'entity' in state ? state.entity : undefined

  const [title, setTitle] = useState(entity?.title ?? '')
  const [description, setDescription] = useState(entity?.description ?? '')
  const [phase, setPhase] = useState<string>(
    entity && 'phase' in entity ? entity.phase : 'Build',
  )
  const [accent, setAccent] = useState<string>(
    entity && 'accent' in entity ? entity.accent : ACCENTS[0],
  )
  const [minutes, setMinutes] = useState<string>(
    state.kind === 'lesson' && entity ? String(Math.round((entity as Lesson).durationSeconds / 60)) : '',
  )
  const [vimeoUrl, setVimeoUrl] = useState<string>(
    state.kind === 'lesson' && entity ? ((entity as Lesson).vimeoId ?? '') : '',
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Live lesson from the tree, so the attachments list reflects uploads/deletes.
  const liveLesson = isLesson && state.mode === 'edit'
    ? findAdminLesson(admin.categories, state.id)
    : null
  const vimeoInvalid = isLesson && vimeoUrl.trim() !== '' && !parseVimeo(vimeoUrl)

  const noun = isCategory ? 'categoria' : isCourse ? 'corso' : 'lezione'
  const heading = `${state.mode === 'create' ? 'Nuova' : 'Modifica'} ${noun}`

  const submit = async () => {
    if (!title.trim() || saving || vimeoInvalid) return
    setSaving(true)
    let ok = false
    if (isCategory) {
      const input: CategoryInput = { title, description, accent, phase }
      ok = state.mode === 'create' ? await admin.createCategory(input) : await admin.updateCategory(state.id, input)
    } else if (isCourse) {
      const input: CourseInput = { title, description, phase }
      ok = state.mode === 'create' ? await admin.createCourse(state.parentId, input) : await admin.updateCourse(state.id, input)
    } else {
      const input: LessonInput = { title, description, durationMinutes: Number(minutes) || 0, vimeoId: vimeoUrl }
      ok = state.mode === 'create' ? await admin.createLesson(state.parentId, input) : await admin.updateLesson(state.id, input)
    }
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden"
        style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ist-border)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>{heading}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--ist-text-dim)' }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Titolo</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)} autoFocus
              placeholder={`Titolo ${noun}`}
              className="px-3 py-2.5 text-sm" style={inputStyle}
            />
          </div>

          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Descrizione</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Breve descrizione"
              className="px-3 py-2.5 text-sm resize-none" style={inputStyle}
            />
          </div>

          {(isCategory || isCourse) && (
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Fase</label>
              <select value={phase} onChange={e => setPhase(e.target.value)} className="px-3 py-2.5 text-sm" style={inputStyle}>
                {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {isCategory && (
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Colore accento</label>
              <div className="flex gap-2 flex-wrap">
                {ACCENTS.map(c => (
                  <button
                    key={c} onClick={() => setAccent(c)}
                    className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, border: accent === c ? '2px solid var(--ist-text)' : '2px solid transparent', boxShadow: `0 0 8px ${c}55` }}
                  />
                ))}
              </div>
            </div>
          )}

          {isLesson && (
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Durata (minuti)</label>
              <input
                value={minutes} onChange={e => setMinutes(e.target.value)} type="number" min="0"
                placeholder="es. 18" className="px-3 py-2.5 text-sm" style={inputStyle}
              />
            </div>
          )}

          {isLesson && (
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Link o ID Vimeo</label>
              <input
                value={vimeoUrl} onChange={e => setVimeoUrl(e.target.value)}
                placeholder="https://vimeo.com/123456789"
                className="px-3 py-2.5 text-sm" style={inputStyle}
              />
              {vimeoInvalid
                ? <p className="text-[11px] mt-1" style={{ color: '#FF6B7A' }}>Link Vimeo non riconosciuto.</p>
                : <p className="text-[11px] mt-1" style={{ color: 'var(--ist-text-dim)' }}>Incolla l'URL del video Vimeo (o solo l'ID). Vuoto = nessun video.</p>}
            </div>
          )}

          {isLesson && state.mode === 'edit' && (
            <div>
              <label className="text-xs block mb-2" style={{ color: 'var(--ist-text-muted)' }}>Allegati</label>
              <div className="space-y-1.5">
                {liveLesson?.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-border)' }}>
                    <Paperclip size={12} strokeWidth={2} style={{ color: 'var(--ist-text-dim)', flexShrink: 0 }} />
                    <span className="flex-1 text-xs truncate" style={{ color: 'var(--ist-text)' }}>{att.name}</span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>{att.size}</span>
                    <button
                      onClick={async () => { if (confirm(`Eliminare "${att.name}"?`)) { await deleteAttachment(att.id, att.objectKey); await admin.reload() } }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/[0.06]"
                      style={{ color: 'rgba(255,107,122,0.7)' }}
                    >
                      <Trash2 size={12} strokeWidth={2} />
                    </button>
                  </div>
                ))}
                {(!liveLesson || liveLesson.attachments.length === 0) && (
                  <p className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>Nessun allegato.</p>
                )}
              </div>
              <label
                className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium cursor-pointer transition-colors hover:bg-white/[0.04]"
                style={{ border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-accent-text)', opacity: uploading ? 0.5 : 1 }}
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} strokeWidth={2} />}
                {uploading ? 'Caricamento…' : 'Carica allegato'}
                <input
                  type="file" className="hidden" disabled={uploading}
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt,.zip"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setUploading(true)
                    const ok = await uploadAttachment(state.id, file, liveLesson?.attachments.length ?? 0)
                    if (ok) await admin.reload()
                    setUploading(false)
                    if (!ok) alert('Upload non riuscito.')
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--ist-border)' }}>
          <button
            onClick={submit} disabled={saving || !title.trim()}
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-full transition-all" style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Lesson row ───────────────────────────────────────────────────────────────

function LessonRow({ lesson, courseId, isLast, isFirst, admin, onEdit }: {
  lesson: Lesson; courseId: string; isLast: boolean; isFirst: boolean; admin: AdminApi; onEdit: () => void
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-black/[0.02]"
      style={{ borderBottom: !isLast ? '1px solid var(--ist-border)' : 'none' }}
    >
      <MoveBtns
        isFirst={isFirst} isLast={isLast}
        onUp={() => admin.moveLesson(courseId, lesson.id, 'up')}
        onDown={() => admin.moveLesson(courseId, lesson.id, 'down')}
      />
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={lesson.vimeoId
          ? { background: 'rgba(70,211,154,0.12)', color: '#46D39A' }
          : { background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }}
        title={lesson.vimeoId ? 'Video Vimeo collegato' : 'Nessun video (aggiungi il link Vimeo)'}
      >
        <Video size={9} strokeWidth={2} />
      </div>
      <span className="flex-1 text-[11px] font-medium truncate" style={{ color: 'var(--ist-text-muted)' }}>
        {lesson.title}
      </span>
      <div className="flex items-center gap-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {lesson.attachments.length > 0 && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
            <Paperclip size={10} strokeWidth={2} />
            {lesson.attachments.length}
          </span>
        )}
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
          <Clock size={9} strokeWidth={2} />
          {lesson.duration}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <ActionBtn icon={<Edit2 size={10} strokeWidth={2} />} label="Modifica" onClick={onEdit} />
        <ActionBtn
          icon={<Trash2 size={10} strokeWidth={2} />} label="Elimina" danger
          onClick={() => { if (confirm(`Eliminare la lezione "${lesson.title}"?`)) admin.deleteLesson(lesson.id) }}
        />
      </div>
    </div>
  )
}

// ─── Courses Tab ─────────────────────────────────────────────────────────────

function CoursesTab({ admin, openModal }: { admin: AdminApi; openModal: (s: ModalState) => void }) {
  const cats = admin.categories
  const [expanded, setExpanded] = useState<ExpandState>({ categories: new Set(), courses: new Set() })

  const toggleCat    = (id: string) => setExpanded(prev => { const s = new Set(prev.categories); s.has(id) ? s.delete(id) : s.add(id); return { ...prev, categories: s } })
  const toggleCourse = (id: string) => setExpanded(prev => { const s = new Set(prev.courses);    s.has(id) ? s.delete(id) : s.add(id); return { ...prev, courses: s } })

  if (cats.length === 0) {
    return (
      <div className="rounded-3xl p-10 text-center" style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)' }}>
        <p className="text-sm mb-4" style={{ color: 'var(--ist-text-dim)' }}>Nessuna categoria. Crea la prima per iniziare.</p>
        <button
          onClick={() => openModal({ kind: 'category', mode: 'create' })}
          className="px-5 py-2.5 text-sm font-medium rounded-full inline-flex items-center gap-2"
          style={{ border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-accent-text)' }}
        >
          <Plus size={14} strokeWidth={2.5} /> Nuova categoria
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {cats.map((cat, catIdx) => {
        const catExpanded = expanded.categories.has(cat.id)
        const totalLessons = cat.courses.flatMap(c => c.lessons).length

        return (
          <div
            key={cat.id}
            className="rounded-3xl overflow-hidden"
            style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow)' }}
          >
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${cat.accent}, ${cat.accent}40)` }} />

            {/* Category header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: catExpanded ? '1px solid var(--ist-border)' : 'none' }}>
              <MoveBtns
                isFirst={catIdx === 0} isLast={catIdx === cats.length - 1}
                onUp={() => admin.moveCategory(cat.id, 'up')}
                onDown={() => admin.moveCategory(cat.id, 'down')}
              />
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.accent, boxShadow: `0 0 6px ${cat.accent}60` }} />
              <button onClick={() => toggleCat(cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span className="font-bold text-sm truncate" style={{ color: 'var(--ist-text)' }}>{cat.title}</span>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] hidden sm:block" style={{ color: 'var(--ist-text-dim)' }}>
                  {cat.courses.length} corsi · {totalLessons} lezioni
                </span>
                <PhaseBadge phase={cat.phase} />
                <PublishedBadge published={cat.published} />
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <ActionBtn
                  icon={cat.published ? <EyeOff size={11} strokeWidth={2} /> : <Eye size={11} strokeWidth={2} />}
                  label={cat.published ? 'Nascondi' : 'Pubblica'}
                  onClick={() => admin.setPublished('categories', cat.id, !cat.published)}
                />
                <ActionBtn icon={<Edit2 size={11} strokeWidth={2} />} label="Modifica" onClick={() => openModal({ kind: 'category', mode: 'edit', id: cat.id, entity: cat })} />
                <ActionBtn
                  icon={<Trash2 size={11} strokeWidth={2} />} label="Elimina" danger
                  onClick={() => { if (confirm(`Eliminare la categoria "${cat.title}" e tutti i suoi corsi e lezioni?`)) admin.deleteCategory(cat.id) }}
                />
                <button onClick={() => toggleCat(cat.id)} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-black/[0.04]" style={{ color: 'var(--ist-text-dim)' }}>
                  <ChevronDown size={13} strokeWidth={2} style={{ transform: catExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              </div>
            </div>

            {/* Courses */}
            {catExpanded && (
              <div className="pb-3 px-3 flex flex-col gap-2 pt-2">
                {cat.courses.map((course, crsIdx) => {
                  const courseExpanded = expanded.courses.has(course.id)
                  return (
                    <div key={course.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <MoveBtns
                          isFirst={crsIdx === 0} isLast={crsIdx === cat.courses.length - 1}
                          onUp={() => admin.moveCourse(cat.id, course.id, 'up')}
                          onDown={() => admin.moveCourse(cat.id, course.id, 'down')}
                        />
                        <BookOpen size={13} strokeWidth={2} style={{ color: cat.accent, flexShrink: 0 }} />
                        <button onClick={() => toggleCourse(course.id)} className="flex-1 min-w-0 text-left">
                          <span className="text-xs font-semibold truncate block" style={{ color: 'var(--ist-text)' }}>{course.title}</span>
                        </button>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] hidden sm:block" style={{ color: 'var(--ist-text-dim)' }}>{course.lessons.length} lezioni</span>
                          <PhaseBadge phase={course.phase} />
                          <PublishedBadge published={course.published} />
                          <ActionBtn icon={<Plus size={11} strokeWidth={2.5} />} label="lezione" onClick={() => openModal({ kind: 'lesson', mode: 'create', parentId: course.id })} />
                          <ActionBtn
                            icon={course.published ? <EyeOff size={11} strokeWidth={2} /> : <Eye size={11} strokeWidth={2} />}
                            label={course.published ? 'Nascondi' : 'Pubblica'}
                            onClick={() => admin.setPublished('courses', course.id, !course.published)}
                          />
                          <ActionBtn icon={<Edit2 size={11} strokeWidth={2} />} label="Modifica" onClick={() => openModal({ kind: 'course', mode: 'edit', id: course.id, entity: course })} />
                          <ActionBtn
                            icon={<Trash2 size={11} strokeWidth={2} />} label="Elimina" danger
                            onClick={() => { if (confirm(`Eliminare il corso "${course.title}" e tutte le sue lezioni?`)) admin.deleteCourse(course.id) }}
                          />
                          <button onClick={() => toggleCourse(course.id)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-black/[0.04]" style={{ color: 'var(--ist-text-dim)' }}>
                            <ChevronDown size={11} strokeWidth={2} style={{ transform: courseExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>
                        </div>
                      </div>

                      {courseExpanded && (
                        <div style={{ borderTop: '1px solid var(--ist-border)' }}>
                          {course.lessons.map((lesson, i) => (
                            <LessonRow
                              key={lesson.id}
                              lesson={lesson}
                              courseId={course.id}
                              isFirst={i === 0}
                              isLast={i === course.lessons.length - 1}
                              admin={admin}
                              onEdit={() => openModal({ kind: 'lesson', mode: 'edit', id: lesson.id, entity: lesson })}
                            />
                          ))}
                          <button
                            onClick={() => openModal({ kind: 'lesson', mode: 'create', parentId: course.id })}
                            className="w-full flex items-center gap-2 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                            style={{ borderTop: '1px solid var(--ist-border)' }}
                          >
                            <Plus size={12} strokeWidth={2.5} style={{ color: 'var(--ist-accent-text)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--ist-accent-text)' }}>Aggiungi lezione</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                <button
                  onClick={() => openModal({ kind: 'course', mode: 'create', parentId: cat.id })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-colors hover:bg-black/[0.02]"
                  style={{ border: `1px dashed ${cat.accent}35`, color: cat.accent }}
                >
                  <Plus size={12} strokeWidth={2.5} />
                  <span className="text-xs font-medium">Aggiungi corso</span>
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={() => openModal({ kind: 'category', mode: 'create' })}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl transition-all hover:bg-black/[0.02]"
        style={{ border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-accent-text)' }}
      >
        <Plus size={14} strokeWidth={2.5} />
        <span className="text-sm font-medium">Nuova categoria</span>
      </button>
    </div>
  )
}

// ─── Live Tab (reale — Fase D2) ─────────────────────────────────────────────────

const LIVE_STATUS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  live:     { bg: 'rgba(255,80,80,0.10)',   text: '#FF5050', border: 'rgba(255,80,80,0.22)',  label: 'In diretta'   },
  upcoming: { bg: 'rgba(90,154,177,0.12)',  text: '#7CBBD0', border: 'rgba(90,154,177,0.22)', label: 'Programmata'  },
  replay:   { bg: 'var(--ist-w6)',          text: 'var(--ist-text-dim)', border: 'var(--ist-border)', label: 'Replay' },
}

const LIVE_ROLES: { id: LiveRole; label: string }[] = [
  { id: 'coach', label: 'Coach' },
  { id: 'mental_coach', label: 'Mental Coach' },
  { id: 'admin', label: 'Admin' },
]

const EMPTY_LIVE: LiveInput = {
  title: '', description: '', host: '', hostRole: 'coach',
  status: 'upcoming', startsAt: null, zoomUrl: '', replayVimeoId: '',
  durationMinutes: null, accent: '#7CBBD0', accentEnd: '#286680',
}

// datetime-local <-> ISO (in ora locale)
function isoToLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localToIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null
}

function LiveModal({ initial, onSave, onClose }: {
  initial?: LiveEvent
  onSave: (input: LiveInput) => Promise<boolean>
  onClose: () => void
}) {
  const [form, setForm] = useState<LiveInput>(initial ? {
    title: initial.title, description: initial.description, host: initial.host,
    hostRole: initial.hostRole, status: initial.status, startsAt: initial.startsAt,
    zoomUrl: initial.zoomUrl ?? '', replayVimeoId: initial.replayVimeoId ?? '',
    durationMinutes: initial.durationMinutes, accent: initial.accent, accentEnd: initial.accentEnd,
  } : EMPTY_LIVE)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (patch: Partial<LiveInput>) => setForm(f => ({ ...f, ...patch }))
  const isReplay = form.status === 'replay'

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Il titolo è obbligatorio.'); return }
    setSaving(true)
    const ok = await onSave(form)
    setSaving(false)
    if (!ok) { setError('Errore durante il salvataggio.'); return }
    onClose()
  }

  const label = (t: string) => (
    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>{t}</label>
  )

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div
        className="fixed z-50 top-4 bottom-4 right-4 w-full max-w-[440px] overflow-hidden rounded-4xl flex flex-col"
        style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: '0 24px 80px rgba(0,0,0,0.50)', backdropFilter: 'blur(24px)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--ist-text)' }}>
            {initial ? 'Modifica live' : 'Nuova live'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto no-scrollbar">
          {/* Status */}
          <div>
            {label('Stato')}
            <div className="grid grid-cols-3 gap-2">
              {(['upcoming', 'live', 'replay'] as LiveStatus[]).map(st => (
                <button
                  key={st}
                  onClick={() => set({ status: st })}
                  className="py-2 rounded-xl text-xs font-semibold transition-all"
                  style={form.status === st
                    ? { background: LIVE_STATUS[st].bg, color: LIVE_STATUS[st].text, border: `1px solid ${LIVE_STATUS[st].border}` }
                    : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w9)' }}
                >
                  {LIVE_STATUS[st].label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            {label('Titolo *')}
            <input value={form.title} onChange={e => set({ title: e.target.value })} placeholder="Es. Analisi mercati settimanale" className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            {label('Descrizione')}
            <textarea value={form.description} onChange={e => set({ description: e.target.value })} rows={3} placeholder="Di cosa si parla nella sessione..." className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F] resize-none" style={inputStyle} />
          </div>

          {/* Host + role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              {label('Host')}
              <input value={form.host} onChange={e => set({ host: e.target.value })} placeholder="Es. Laura Bianchi" className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
            </div>
            <div>
              {label('Ruolo host')}
              <select value={form.hostRole} onChange={e => set({ hostRole: e.target.value as LiveRole })} className="px-3.5 py-2.5 text-sm" style={inputStyle}>
                {LIVE_ROLES.map(r => <option key={r.id} value={r.id} style={{ background: '#0d1117' }}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            {label(isReplay ? 'Data registrazione' : 'Data e ora')}
            <input type="datetime-local" value={isoToLocal(form.startsAt)} onChange={e => set({ startsAt: localToIso(e.target.value) })} className="px-3.5 py-2.5 text-sm" style={inputStyle} />
          </div>

          {/* Zoom (live/upcoming) or Vimeo+duration (replay) */}
          {isReplay ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                {label('Link/ID Vimeo replay')}
                <input value={form.replayVimeoId ?? ''} onChange={e => set({ replayVimeoId: e.target.value })} placeholder="vimeo.com/..." className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
              </div>
              <div>
                {label('Durata (min)')}
                <input type="number" min="0" value={form.durationMinutes ?? ''} onChange={e => set({ durationMinutes: e.target.value ? parseInt(e.target.value) : null })} placeholder="60" className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
              </div>
            </div>
          ) : (
            <div>
              {label('Link Zoom')}
              <input value={form.zoomUrl ?? ''} onChange={e => set({ zoomUrl: e.target.value })} placeholder="https://zoom.us/j/..." className="px-3.5 py-2.5 text-sm placeholder:text-[#56636F]" style={inputStyle} />
            </div>
          )}

          {/* Accent */}
          <div>
            {label('Colore')}
            <div className="flex gap-2 flex-wrap">
              {ACCENTS.map(c => (
                <button
                  key={c}
                  onClick={() => set({ accent: c })}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                  style={{ background: c, border: form.accent === c ? '2px solid var(--ist-text)' : '2px solid transparent' }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--ist-w8)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-2xl" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold rounded-2xl text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', boxShadow: '0 4px 14px rgba(40,102,128,0.30)' }}
          >
            {saving && <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />}
            {initial ? 'Salva modifiche' : 'Crea live'}
          </button>
        </div>
      </div>
    </>
  )
}

function LiveTab({ api }: { api: ReturnType<typeof useLiveAdmin> }) {
  const [modal, setModal] = useState<{ open: boolean; editing?: LiveEvent }>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  if (api.loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div>
  }

  return (
    <div className="space-y-2.5">
      <button
        onClick={() => setModal({ open: true })}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl transition-all hover:bg-black/[0.02] mb-1"
        style={{ border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-accent-text)' }}
      >
        <Plus size={14} strokeWidth={2.5} />
        <span className="text-sm font-medium">Nuova live</span>
      </button>

      {api.events.length === 0 && (
        <p className="text-[11px] text-center py-6" style={{ color: 'var(--ist-text-dim)' }}>
          Nessuna live. Creane una con il pulsante qui sopra.
        </p>
      )}

      {api.events.map(event => {
        const s = LIVE_STATUS[event.status]
        return (
          <div
            key={event.id}
            className="flex items-center gap-4 p-4 lg:p-5 rounded-3xl"
            style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow)' }}
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${event.accent}12`, border: `1px solid ${event.accent}22` }}>
              <Radio size={16} strokeWidth={2} style={{ color: event.accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--ist-text)' }}>{event.title}</p>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>{s.label}</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
                {event.host || '—'} · {liveDateLabel(event)}
                {liveDurationLabel(event) && <> · {liveDurationLabel(event)}</>}
              </p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {deleteConfirm === event.id ? (
                <>
                  <span className="text-[10px] mr-1" style={{ color: 'var(--ist-text-muted)' }}>Eliminare?</span>
                  <ActionBtn icon={<Trash2 size={11} strokeWidth={2} />} label="Sì" danger onClick={async () => { await api.deleteLive(event.id); setDeleteConfirm(null) }} />
                  <ActionBtn icon={<X size={11} strokeWidth={2} />} label="No" onClick={() => setDeleteConfirm(null)} />
                </>
              ) : (
                <>
                  <ActionBtn icon={<Edit2 size={11} strokeWidth={2} />} label="Modifica" onClick={() => setModal({ open: true, editing: event })} />
                  <ActionBtn icon={<Trash2 size={11} strokeWidth={2} />} label="Elimina" danger onClick={() => setDeleteConfirm(event.id)} />
                </>
              )}
            </div>
          </div>
        )
      })}

      {modal.open && (
        <LiveModal
          initial={modal.editing}
          onSave={input => modal.editing ? api.updateLive(modal.editing.id, input) : api.createLive(input)}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminContenuti() {
  const admin = useContentAdmin()
  const liveAdmin = useLiveAdmin()
  const [tab, setTab] = useState<Tab>('corsi')
  const [modal, setModal] = useState<ModalState | null>(null)

  const totalCats    = admin.categories.length
  const totalCourses = admin.categories.reduce((s, c) => s + c.courses.length, 0)
  const totalLessons = admin.categories.reduce((s, c) => s + c.courses.reduce((t, cr) => t + cr.lessons.length, 0), 0)
  const totalLive    = liveAdmin.events.length

  const tabs = [
    { id: 'corsi' as Tab, label: 'Videocorsi', count: totalCats },
    { id: 'live'  as Tab, label: 'Live & Replay', count: totalLive },
  ]

  return (
    <div className="p-5 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Gestione Contenuti"
        subtitle="Categorie, videocorsi, lezioni e sessioni live"
        action={
          <button
            onClick={() => setModal({ kind: 'category', mode: 'create' })}
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(40,102,128,0.36)' }}
          >
            + Categoria
          </button>
        }
      />

      {/* Stats bar */}
      <div className="flex items-center gap-5 px-5 py-3.5 rounded-2xl mb-6 flex-wrap" style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow)' }}>
        {[
          { label: 'Categorie', value: totalCats,    icon: <FolderOpen size={13} strokeWidth={2} /> },
          { label: 'Corsi',     value: totalCourses, icon: <BookOpen   size={13} strokeWidth={2} /> },
          { label: 'Lezioni',   value: totalLessons, icon: <Video      size={13} strokeWidth={2} /> },
          { label: 'Live',      value: totalLive,    icon: <Radio      size={13} strokeWidth={2} /> },
        ].map((s, i, arr) => (
          <div key={s.label} className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'var(--ist-accent-text)' }}>{s.icon}</span>
              <span className="text-xl font-bold" style={{ color: 'var(--ist-text)' }}>{s.value}</span>
              <span className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>{s.label}</span>
            </div>
            {i < arr.length - 1 && <div className="w-px h-5 hidden sm:block" style={{ background: 'var(--ist-border)' }} />}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-2xl w-fit" style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-border)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === t.id
              ? { background: 'var(--ist-card-bg)', color: 'var(--ist-text)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }
              : { color: 'var(--ist-text-muted)' }}
          >
            {t.label}
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={tab === t.id ? { background: 'rgba(90,154,177,0.15)', color: 'var(--ist-accent-text)' } : { background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'corsi' && (
        admin.loading
          ? <div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div>
          : <CoursesTab admin={admin} openModal={setModal} />
      )}
      {tab === 'live' && <LiveTab api={liveAdmin} />}

      {modal && <EditorModal key={`${modal.kind}-${modal.mode}-${'id' in modal ? modal.id : 'parentId' in modal ? modal.parentId : 'new'}`} state={modal} admin={admin} onClose={() => setModal(null)} />}
    </div>
  )
}
