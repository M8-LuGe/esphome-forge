import { Cpu, ChevronRight } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import type { WizardStep } from '@/store/useProjectStore'

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'board-select',  label: 'Board' },
  { id: 'board-detail',  label: 'GPIOs' },
  { id: 'add-component', label: 'Komponenten' },
  { id: 'automation',    label: 'Automationen' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { step, setStep, selectedBoardSummary, clearBoard } = useProjectStore()

  const currentIdx = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="flex h-full flex-col bg-surface text-white">
      {/* ── Top Bar ── */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-4">
        <Cpu className="h-5 w-5 text-forge-500" />
        <span className="font-semibold tracking-tight">ESPHome Forge</span>

        {/* Breadcrumb / Stepper */}
        <nav className="ml-4 flex items-center gap-1 text-sm">
          {STEPS.map((s, i) => {
            const isActive  = s.id === step
            const isDone    = i < currentIdx
            const clickable = isDone || (i === currentIdx - 1)

            return (
              <span key={s.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
                <button
                  disabled={!clickable && !isDone}
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

        {/* Aktuelles Board (Pill) */}
        {selectedBoardSummary && (
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full bg-forge-900/60 px-3 py-0.5 text-xs text-forge-300 ring-1 ring-forge-700/40">
              {selectedBoardSummary.name}
            </span>
            <button
              onClick={clearBoard}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              title="Board abwählen und neu starten"
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-auto p-4">
        {children}
      </main>
    </div>
  )
}
