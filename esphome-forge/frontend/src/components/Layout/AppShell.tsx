import { Cpu, ChevronRight, Home } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import type { WizardStep } from '@/store/useProjectStore'

/** Steps die innerhalb eines Projekts angezeigt werden */
const PROJECT_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'board-detail',  label: 'Projekt' },
  { id: 'automation',    label: 'Automationen' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { step, setStep, activeProject, selectedBoardSummary, clearProject, pendingProjectName } = useProjectStore()

  const isInProject = step !== 'project-list'
  const currentIdx = PROJECT_STEPS.findIndex((s) => s.id === step)

  return (
    <div className="flex h-full flex-col bg-surface text-white">
      {/* ── Top Bar ── */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-4">
        <Cpu className="h-5 w-5 text-forge-500" />
        <span className="font-semibold tracking-tight">ESPHome Forge</span>

        {/* ── Home / Zurück ── */}
        {isInProject && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <button
              onClick={clearProject}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-sm text-slate-400 transition-colors hover:text-white"
              title="Zurück zur Projektliste"
            >
              <Home className="h-3.5 w-3.5" />
              Projekte
            </button>
          </>
        )}

        {/* ── Board-Auswahl-Schritt (neues Projekt) ── */}
        {step === 'board-select' && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <span className="rounded bg-forge-600/30 px-2 py-0.5 text-sm font-medium text-forge-400">
              Board auswählen
            </span>
          </>
        )}

        {/* ── Projekt-Stepper (innerhalb eines Projekts) ── */}
        {activeProject && step !== 'board-select' && (
          <nav className="ml-2 flex items-center gap-1 text-sm">
            {PROJECT_STEPS.map((s, i) => {
              const isActive  = s.id === step
              const isDone    = i < currentIdx
              const clickable = isDone

              return (
                <span key={s.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                  <button
                    disabled={!clickable && !isActive}
                    onClick={() => clickable && setStep(s.id)}
                    className={[
                      'rounded px-2 py-0.5 transition-colors',
                      isActive  ? 'bg-forge-600/30 text-forge-400 font-medium' : '',
                      isDone    ? 'text-slate-400 hover:text-white cursor-pointer' : '',
                      !isDone && !isActive ? 'text-slate-600 cursor-default' : '',
                    ].join(' ')}
                  >
                    {s.label}
                  </button>
                </span>
              )
            })}
          </nav>
        )}

        {/* ── Aktives Projekt / Board Pill ── */}
        <div className="ml-auto flex items-center gap-2">
          {activeProject && (
            <span className="rounded-full bg-surface-overlay px-3 py-0.5 text-xs text-slate-300 ring-1 ring-border">
              {activeProject.name}
            </span>
          )}
          {pendingProjectName !== null && !activeProject && (
            <span className="rounded-full bg-yellow-900/40 px-3 py-0.5 text-xs text-yellow-300 ring-1 ring-yellow-700/40">
              Neues Projekt
            </span>
          )}
          {selectedBoardSummary && (
            <span className="rounded-full bg-forge-900/60 px-3 py-0.5 text-xs text-forge-300 ring-1 ring-forge-700/40">
              {selectedBoardSummary.name}
            </span>
          )}
          {isInProject && (
            <button
              onClick={clearProject}
              className="text-xs text-slate-500 transition-colors hover:text-red-400"
              title="Projekt schließen"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-auto p-4">
        {children}
      </main>
    </div>
  )
}
