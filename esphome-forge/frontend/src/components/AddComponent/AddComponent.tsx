import { useState } from 'react'
import { generateUUID } from '@/utils/uuid'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Loader2,
  Search,
  ExternalLink,
  Plus,
  Wrench,
  RefreshCw,
  Cable,
  Wifi,
  Bluetooth,
  Cpu,
  Gauge,
  ToggleLeft,
  Monitor,
  Lightbulb,
  Power,
  Thermometer,
  Fan,
  SlidersHorizontal,
  Volume2,
  Clock,
  Radio,
  Wind,
  Sun,
  Ruler,
  Zap,
  Activity,
  Hash,
  GitBranch,
  Globe,
  Package,
  Square,
  Radar,
  Trash2,
  FileCode,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import { componentsApi } from '@/api/components'
import { projectsApi } from '@/api/projects'
import { useProjectStore } from '@/store/useProjectStore'
import { PinConfigurator } from './PinConfigurator'
import type { ComponentSummary } from '@/types/component'

/** Map Lucide icon name → component */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  thermometer: Thermometer,
  sun: Sun,
  radar: Radar,
  ruler: Ruler,
  zap: Zap,
  wind: Wind,
  activity: Activity,
  gauge: Gauge,
  'toggle-left': ToggleLeft,
  monitor: Monitor,
  lightbulb: Lightbulb,
  power: Power,
  fan: Fan,
  blinds: Monitor, // fallback
  'volume-2': Volume2,
  'sliders-horizontal': SlidersHorizontal,
  square: Square,
  hash: Hash,
  clock: Clock,
  cable: Cable,
  'git-branch': GitBranch,
  wifi: Wifi,
  bluetooth: Bluetooth,
  radio: Radio,
  cpu: Cpu,
  package: Package,
  wrench: Wrench,
  home: Globe,
  cloud: Globe,
  'file-text': Package,
  mic: Volume2,
  camera: Monitor,
  globe: Globe,
  download: Package,
  settings: Package,
  hand: ToggleLeft,
  palette: Lightbulb,
  'layout-dashboard': Monitor,
  nfc: ToggleLeft,
}

function IconFor({ name, className }: { name: string | null; className?: string }) {
  const Comp = ICON_MAP[name ?? ''] ?? Package
  return <Comp className={className} />
}

// ── Bus-Typ Badge ─────────────────────────────────────────────────────────────
const BUS_COLORS: Record<string, string> = {
  i2c: 'bg-blue-500/15 text-blue-400',
  spi: 'bg-purple-500/15 text-purple-400',
  uart: 'bg-amber-500/15 text-amber-400',
  gpio: 'bg-green-500/15 text-green-400',
  '1wire': 'bg-cyan-500/15 text-cyan-400',
  ble: 'bg-indigo-500/15 text-indigo-400',
  wifi: 'bg-sky-500/15 text-sky-400',
  i2s: 'bg-pink-500/15 text-pink-400',
  can: 'bg-red-500/15 text-red-400',
  none: 'bg-slate-500/15 text-slate-400',
}

function BusBadge({ bus }: { bus: string | null }) {
  if (!bus || bus === 'none') return null
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        BUS_COLORS[bus] ?? BUS_COLORS.none,
      )}
    >
      {bus}
    </span>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function AddComponent() {
  const { setStep, addComponent, removeComponent, components, activeProject } = useProjectStore()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedComp, setSelectedComp] = useState<ComponentSummary | null>(null)
  const [configuringComp, setConfiguringComp] = useState<ComponentSummary | null>(null)
  const [showYaml, setShowYaml] = useState(false)

  // Kategorien laden
  const { data: categories = [] } = useQuery({
    queryKey: ['component-categories'],
    queryFn: componentsApi.categories,
  })

  // Komponenten laden (gefiltert am Server)
  const {
    data: compList = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['components', selectedCategory, search],
    queryFn: () =>
      componentsApi.list({
        category: selectedCategory ?? undefined,
        q: search || undefined,
      }),
  })

  // YAML Preview
  const { data: yamlContent, refetch: refetchYaml } = useQuery({
    queryKey: ['project-yaml', activeProject?.id, components.length],
    queryFn: () => (activeProject ? projectsApi.getYaml(activeProject.id) : Promise.resolve('')),
    enabled: !!activeProject && showYaml,
  })

  const handleAddClick = (comp: ComponentSummary) => {
    setConfiguringComp(comp)
  }

  const handlePinConfirm = (pins: Record<string, number>, config: Record<string, unknown>) => {
    if (!configuringComp) return
    addComponent({
      uid: generateUUID(),
      compType: configuringComp.id,
      name: configuringComp.name,
      pins,
      ha_visible: true,
      config,
    })
    setConfiguringComp(null)
    setSelectedComp(null)
    // YAML nach kurzem Delay neu laden (Backend braucht einen Moment)
    setTimeout(() => refetchYaml(), 500)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('board-detail')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-raised hover:text-slate-200 transition-colors"
            title="Zurück zum Board"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Komponente hinzufügen</h1>
            {activeProject && (
              <p className="text-xs text-slate-500">Projekt: {activeProject.name}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-surface-raised hover:text-slate-200 transition-colors"
          title="Komponenten neu laden"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Aktualisieren
        </button>
      </div>

      {/* ── Hinzugefügte Komponenten (Leiste) ── */}
      {components.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-raised p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Hinzugefügt ({components.length})
            </h3>
            <button
              onClick={() => setShowYaml(!showYaml)}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors',
                showYaml
                  ? 'bg-forge-600/20 text-forge-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface',
              )}
            >
              <FileCode className="h-3 w-3" />
              YAML
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {components.map((c) => (
              <div
                key={c.uid}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface pl-2.5 pr-1 py-1"
              >
                <span className="text-xs text-slate-300">{c.name}</span>
                {Object.keys(c.pins).length > 0 && (
                  <span className="text-[10px] text-slate-600">
                    ({Object.entries(c.pins).map(([r, g]) => `${r}:${g}`).join(', ')})
                  </span>
                )}
                <button
                  onClick={() => {
                    removeComponent(c.uid)
                    setTimeout(() => refetchYaml(), 500)
                  }}
                  className="rounded-full p-0.5 text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title="Entfernen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* YAML Preview */}
          {showYaml && yamlContent && (
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-green-400 font-mono">
              {yamlContent}
            </pre>
          )}
        </div>
      )}

      {/* ── Suche ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sensor, Display, LED, I²C … suchen"
          className="w-full rounded-lg border border-border bg-surface-raised pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-forge-500"
        />
      </div>

      <div className="flex gap-4">
        {/* ── Kategorie-Sidebar ── */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-4 space-y-0.5">
            <button
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                !selectedCategory
                  ? 'bg-forge-600/20 text-forge-400'
                  : 'text-slate-400 hover:bg-surface-raised hover:text-slate-200',
              )}
            >
              <Package className="h-3.5 w-3.5" />
              Alle
              <span className="ml-auto tabular-nums text-[10px] text-slate-500">
                {categories.reduce((s, c) => s + c.count, 0)}
              </span>
            </button>
            {categories.filter(c => c.count > 0).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  selectedCategory === cat.id
                    ? 'bg-forge-600/20 text-forge-400'
                    : 'text-slate-400 hover:bg-surface-raised hover:text-slate-200',
                )}
              >
                <IconFor name={cat.icon} className="h-3.5 w-3.5" />
                <span className="truncate">{cat.name}</span>
                <span className="ml-auto tabular-nums text-[10px] text-slate-500">
                  {cat.count}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Kategorie-Chips (Mobile) ── */}
        <div className="flex flex-wrap gap-1.5 lg:hidden mb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              !selectedCategory ? 'bg-forge-600 text-white' : 'bg-surface-raised text-slate-400',
            )}
          >
            Alle
          </button>
          {categories.filter(c => c.count > 0).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                selectedCategory === cat.id
                  ? 'bg-forge-600 text-white'
                  : 'bg-surface-raised text-slate-400',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* ── Komponentenliste ── */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Komponenten laden…</span>
            </div>
          ) : compList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
              <Search className="h-8 w-8 opacity-40" />
              <p className="text-sm">Keine Komponenten gefunden</p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-forge-400 hover:underline"
                >
                  Suche zurücksetzen
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {compList.map((comp) => (
                <ComponentRow
                  key={comp.id}
                  comp={comp}
                  isSelected={selectedComp?.id === comp.id}
                  onSelect={() =>
                    setSelectedComp(selectedComp?.id === comp.id ? null : comp)
                  }
                  onAdd={() => handleAddClick(comp)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PinConfigurator Modal ── */}
      {configuringComp && (
        <PinConfigurator
          component={configuringComp}
          onConfirm={handlePinConfirm}
          onCancel={() => setConfiguringComp(null)}
        />
      )}
    </div>
  )
}

// ── Einzelne Komponentenzeile ─────────────────────────────────────────────────

function ComponentRow({
  comp,
  isSelected,
  onSelect,
  onAdd,
}: {
  comp: ComponentSummary
  isSelected: boolean
  onSelect: () => void
  onAdd: () => void
}) {
  return (
    <div
      className={clsx(
        'group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer',
        isSelected
          ? 'border-forge-500/40 bg-forge-600/10'
          : 'border-border bg-surface-raised hover:border-slate-600',
      )}
      onClick={onSelect}
    >
      {/* Icon */}
      <div
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          isSelected ? 'bg-forge-600/20 text-forge-400' : 'bg-surface text-slate-400',
        )}
      >
        <IconFor name={comp.icon} className="h-4.5 w-4.5" />
      </div>

      {/* Name + Beschreibung */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-200">
            {comp.name}
          </span>
          {comp.is_custom && (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
              Custom
            </span>
          )}
        </div>
        {comp.description && (
          <p className="truncate text-xs text-slate-500">{comp.description}</p>
        )}
      </div>

      {/* Bus Badge */}
      <BusBadge bus={comp.bus_type} />

      {/* Platform Badge */}
      {comp.platform_type && (
        <span className="hidden sm:inline-flex shrink-0 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-500 font-mono">
          {comp.platform_type}
        </span>
      )}

      {/* Doku-Link */}
      {comp.doc_url && (
        <a
          href={comp.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded p-1 text-slate-500 hover:text-forge-400 transition-colors"
          title="ESPHome Dokumentation"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {/* Hinzufügen-Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAdd()
        }}
        className={clsx(
          'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
          isSelected
            ? 'bg-forge-600 text-white hover:bg-forge-500'
            : 'bg-transparent text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-forge-600/20 hover:text-forge-400',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Hinzufügen
      </button>
    </div>
  )
}
