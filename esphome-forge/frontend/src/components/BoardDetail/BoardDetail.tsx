import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Loader2,
  Cpu,
  Zap,
  CircuitBoard,
  Trash2,
  FileCode,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import clsx from 'clsx'
import { boardsApi } from '@/api/boards'
import { projectsApi } from '@/api/projects'
import { useProjectStore } from '@/store/useProjectStore'
import { GpioMatrix } from '@/components/GpioMatrix/GpioMatrix'
import { ComponentDrawer } from '@/components/AddComponent/ComponentDrawer'
import { DevicePanel } from '@/components/DevicePanel/DevicePanel'

export function BoardDetail() {
  const {
    selectedBoardSummary,
    selectedBoard,
    setFullBoard,
    activeProject,
    components,
    removeComponent,
  } = useProjectStore()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showYaml, setShowYaml] = useState(false)
  const [boardInfoOpen, setBoardInfoOpen] = useState(false)

  // Falls nur Summary vorhanden: Board nachladen
  const { isLoading } = useQuery({
    queryKey: ['board', selectedBoardSummary?.id],
    queryFn:  () => boardsApi.get(selectedBoardSummary!.id),
    enabled:  !!selectedBoardSummary && !selectedBoard,
    onSuccess: setFullBoard,
  } as Parameters<typeof useQuery>[0])

  // YAML Preview
  const { data: yamlContent, refetch: refetchYaml } = useQuery({
    queryKey: ['project-yaml', activeProject?.id, components.length],
    queryFn: () => (activeProject ? projectsApi.getYaml(activeProject.id) : Promise.resolve('')),
    enabled: !!activeProject && showYaml,
  })

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
    <div className="mx-auto max-w-6xl space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{board.name}</h1>
          {board.manufacturer && (
            <p className="text-sm text-slate-400">{board.manufacturer}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* YAML Toggle */}
          <button
            onClick={() => { setShowYaml(!showYaml); if (!showYaml) setTimeout(() => refetchYaml(), 100) }}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              showYaml
                ? 'bg-forge-600/20 text-forge-400 ring-1 ring-forge-500/30'
                : 'text-slate-400 hover:bg-surface-raised hover:text-slate-200',
            )}
          >
            <FileCode className="h-3.5 w-3.5" />
            YAML
          </button>
          {/* Komponente hinzufügen */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-medium text-white hover:bg-forge-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Komponente
          </button>
        </div>
      </div>

      {/* ── Device Panel (Compile / Flash / Status) ── */}
      <DevicePanel />

      {/* ── Hinzugefügte Komponenten ── */}
      {components.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Projekt-Komponenten ({components.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {components.map((c) => (
              <div
                key={c.uid}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forge-500/10 text-forge-400">
                  <Cpu className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{c.name}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {Object.entries(c.pins).map(([role, gpio]) => (
                      <span
                        key={role}
                        className="rounded-full bg-forge-500/10 px-1.5 py-0.5 text-[10px] font-mono text-forge-300"
                      >
                        {role}: GPIO{gpio}
                      </span>
                    ))}
                    {Object.keys(c.pins).length === 0 && (
                      <span className="text-[10px] text-slate-600">Bus-Komponente</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    removeComponent(c.uid)
                    if (showYaml) setTimeout(() => refetchYaml(), 500)
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title="Entfernen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── YAML Preview ── */}
      {showYaml && (
        <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
          <div className="border-b border-border px-4 py-2.5 flex items-center gap-2">
            <FileCode className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-semibold text-slate-300">Generiertes YAML</span>
          </div>
          <pre className="max-h-72 overflow-auto px-4 py-3 text-[11px] leading-relaxed text-green-400 font-mono bg-black/30">
            {yamlContent || 'Lade…'}
          </pre>
        </div>
      )}

      {/* ── GPIO-Matrix (mit Komponenten-Pins!) ── */}
      <GpioMatrix board={board} components={components} />

      {/* ── Board-Details (einklappbar) ── */}
      <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
        <button
          onClick={() => setBoardInfoOpen(!boardInfoOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-surface-overlay transition-colors"
        >
          <span>Board-Details</span>
          {boardInfoOpen
            ? <ChevronUp className="h-4 w-4 text-slate-500" />
            : <ChevronDown className="h-4 w-4 text-slate-500" />
          }
        </button>

        {boardInfoOpen && (
          <div className="border-t border-border p-4">
            {board.aliases && board.aliases.length > 0 && (
              <p className="mb-3 text-xs text-slate-500">
                Auch bekannt als: {board.aliases.join(', ')}
              </p>
            )}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Chip-Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Cpu className="h-4 w-4 text-forge-400" />
                  Chip
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  {([
                    ['Familie',     chip.family],
                    ['Modell',      chip.model],
                    ['Architektur', chip.cpu_arch],
                    ['Kerne',       chip.cpu_cores],
                    ['Takt',        `${chip.cpu_mhz} MHz`],
                    ['RAM',         `${chip.ram_kb} KB`],
                    ['Flash',       `${chip.flash_mb} MB`],
                    ['PSRAM',       chip.psram_mb ? `${chip.psram_mb} MB (${chip.psram_mode})` : '—'],
                    ['WiFi',        chip.wifi ? '✓' : '—'],
                    ['Bluetooth',   chip.bluetooth ?? '—'],
                    ['Native USB',  chip.usb_native ? '✓' : '—'],
                  ] as [string, string | number][]).map(([k, v]) => (
                    <span key={k} className="contents">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="font-mono text-slate-200">{v}</dd>
                    </span>
                  ))}
                </dl>
              </div>

              {/* Built-in Komponenten */}
              <div className="space-y-3">
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

              {/* Power */}
              <div className="space-y-3">
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
          </div>
        )}
      </div>

      {/* ── Component Drawer (Slide-over) ── */}
      <ComponentDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
