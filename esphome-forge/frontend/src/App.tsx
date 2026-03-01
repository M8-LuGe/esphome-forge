import { AppShell } from '@/components/Layout/AppShell'
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
  const { step } = useProjectStore()

  return (
    <AppShell>
      {step === 'board-select'  && <BoardPicker />}
      {step === 'board-detail'  && <BoardDetail />}
      {step === 'add-component' && <ComingSoon title="Komponenten-Konfigurator" />}
      {step === 'automation'    && <ComingSoon title="Flow-Editor / Automationen" />}
    </AppShell>
  )
}
