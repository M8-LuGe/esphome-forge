import { useEffect } from 'react'
import { AppShell } from '@/components/Layout/AppShell'
import { ProjectManager } from '@/components/ProjectManager/ProjectManager'
import { BoardPicker } from '@/components/BoardPicker/BoardPicker'
import { BoardDetail } from '@/components/BoardDetail/BoardDetail'
import { useProjectStore } from '@/store/useProjectStore'

// Platzhalter für spätere Schritte
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
      <span className="text-4xl">🔧</span>
      <p className="text-sm font-medium">{title} – kommt bald</p>
    </div>
  )
}

export default function App() {
  const { step, activeProject, pendingProjectName, setStep } = useProjectStore()

  // Guard: Falls board-select ohne Projekt-Kontext → zurück zur Projektliste
  useEffect(() => {
    if (step === 'board-select' && pendingProjectName === null) {
      setStep('project-list')
    }
    if (step !== 'project-list' && step !== 'board-select' && !activeProject) {
      setStep('project-list')
    }
    // Fallback: ungültige Steps (z.B. gelöschtes 'add-component' aus localStorage) abfangen
    const validSteps: string[] = ['project-list', 'board-select', 'board-detail', 'automation']
    if (!validSteps.includes(step)) {
      setStep(activeProject ? 'board-detail' : 'project-list')
    }
  }, [step, activeProject, pendingProjectName, setStep])

  return (
    <AppShell>
      {step === 'project-list'  && <ProjectManager />}
      {step === 'board-select'  && <BoardPicker />}
      {step === 'board-detail'  && <BoardDetail />}
      {step === 'automation'    && <ComingSoon title="Flow-Editor / Automationen" />}
    </AppShell>
  )
}
