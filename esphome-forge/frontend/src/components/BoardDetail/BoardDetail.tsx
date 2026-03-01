import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Loader2, Cpu, Zap, CircuitBoard } from 'lucide-react'
import clsx from 'clsx'
import { boardsApi } from '@/api/boards'
import { useProjectStore } from '@/store/useProjectStore'
import { GpioMatrix } from '@/components/GpioMatrix/GpioMatrix'

export function BoardDetail() {
  const { selectedBoardSummary, selectedBoard, setFullBoard, setStep } = useProjectStore()

  // Falls nur Summary vorhanden: Board nachladen
  const { isLoading } = useQuery({
    queryKey: ['board', selectedBoardSummary?.id],
    queryFn:  () => boardsApi.get(selectedBoardSummary!.id),
    enabled:  !!selectedBoardSummary && !selectedBoard,
    onSuccess: setFullBoard,
  } as Parameters<typeof useQuery>[0])

  const board = selectedBoard

  if (isLoading || !board) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Board-Details laden…</span>
      </div>
    )
  }

  const { chip } = board

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{board.name}</h1>
          {board.manufacturer && (
            <p className="text-sm text-slate-400">{board.manufacturer}</p>
          )}
          {board.aliases && board.aliases.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Auch bekannt als: {board.aliases.join(', ')}
            </p>
          )}
        </div>
        <button
          onClick={() => setStep('add-component')}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-medium text-white hover:bg-forge-500 transition-colors"
        >
          Komponente hinzufügen
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Chip-Info ── */}
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Cpu className="h-4 w-4 text-forge-400" />
            Chip
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {([
              ['Familie',   chip.family],
              ['Modell',    chip.model],
              ['Architektur', chip.cpu_arch],
              ['Kerne',     chip.cpu_cores],
              ['Takt',      `${chip.cpu_mhz} MHz`],
              ['RAM',       `${chip.ram_kb} KB`],
              ['Flash',     `${chip.flash_mb} MB`],
              ['PSRAM',     chip.psram_mb ? `${chip.psram_mb} MB (${chip.psram_mode})` : '—'],
              ['WiFi',      chip.wifi ? '✓' : '—'],
              ['Bluetooth', chip.bluetooth ?? '—'],
              ['Native USB', chip.usb_native ? '✓' : '—'],
            ] as [string, string | number][]).map(([k, v]) => (
              <span key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-mono text-slate-200">{v}</dd>
              </span>
            ))}
          </dl>
        </div>

        {/* ── Built-in Komponenten ── */}
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CircuitBoard className="h-4 w-4 text-orange-400" />
            Onboard-Komponenten
          </div>
          {board.builtin_components && board.builtin_components.length > 0 ? (
            <ul className="space-y-2">
              {board.builtin_components.map((c) => (
                <li key={c.id} className="flex items-start gap-2 rounded-lg bg-surface-overlay px-3 py-2">
                  <span className={clsx('mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                    c.optional ? 'bg-slate-700 text-slate-400' : 'bg-forge-900/50 text-forge-400'
                  )}>
                    {c.type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    {c.esphome_platform && (
                      <p className="text-[11px] text-slate-500 font-mono">{c.esphome_platform}</p>
                    )}
                    {c.optional && <p className="text-[11px] text-yellow-600">Optional</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Keine Onboard-Komponenten.</p>
          )}
        </div>

        {/* ── Power ── */}
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-yellow-400" />
            Spannungsversorgung
          </div>
          {board.power ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-500">Logik</dt>
              <dd className="font-mono">{board.power.voltage_logic} V</dd>
              <dt className="text-slate-500">Input min.</dt>
              <dd className="font-mono">{board.power.voltage_input_min} V</dd>
              <dt className="text-slate-500">Input max.</dt>
              <dd className="font-mono">{board.power.voltage_input_max} V</dd>
            </dl>
          ) : <p className="text-xs text-slate-500">—</p>}

          {board.notes && (
            <div className="rounded-lg bg-yellow-900/20 border border-yellow-800/40 px-3 py-2 text-xs text-yellow-300 leading-relaxed">
              {board.notes}
            </div>
          )}
        </div>
      </div>

      {/* ── GPIO-Matrix ── */}
      <GpioMatrix board={board} />
    </div>
  )
}
