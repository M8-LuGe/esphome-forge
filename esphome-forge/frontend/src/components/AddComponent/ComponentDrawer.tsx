/**
 * ComponentDrawer – Slide-over zum Browsen & Hinzufügen von Komponenten.
 * Wird direkt im BoardDetail (Projektansicht) eingebettet, kein eigener Wizard-Step.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
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
} from 'lucide-react'
import clsx from 'clsx'
import { componentsApi } from '@/api/components'
import { useProjectStore } from '@/store/useProjectStore'
import { PinConfigurator } from './PinConfigurator'
import type { ComponentSummary } from '@/types/component'

// ── Icon-Map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  thermometer: Thermometer, sun: Sun, radar: Radar, ruler: Ruler, zap: Zap,
  wind: Wind, activity: Activity, gauge: Gauge, 'toggle-left': ToggleLeft,
  monitor: Monitor, lightbulb: Lightbulb, power: Power, fan: Fan,
  blinds: Monitor, 'volume-2': Volume2, 'sliders-horizontal': SlidersHorizontal,
  square: Square, hash: Hash, clock: Clock, cable: Cable,
  'git-branch': GitBranch, wifi: Wifi, bluetooth: Bluetooth, radio: Radio,
  cpu: Cpu, package: Package, wrench: Wrench, home: Globe, cloud: Globe,
  'file-text': Package, mic: Volume2, camera: Monitor, globe: Globe,
  download: Package, settings: Package, hand: ToggleLeft, palette: Lightbulb,
  'layout-dashboard': Monitor, nfc: ToggleLeft,
}

function IconFor({ name, className }: { name: string | null; className?: string }) {
  const Comp = ICON_MAP[name ?? ''] ?? Package
  return <Comp className={className} />
}

// ── Bus-Badge ─────────────────────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface ComponentDrawerProps {
  open: boolean
  onClose: () => void
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function ComponentDrawer({ open, onClose }: ComponentDrawerProps) {
  const { addComponent } = useProjectStore()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [configuringComp, setConfiguringComp] = useState<ComponentSummary | null>(null)

  // Kategorien laden
  const { data: categories = [] } = useQuery({
    queryKey: ['component-categories'],
    queryFn: componentsApi.categories,
    enabled: open,
  })

  // Komponenten laden
  const { data: compList = [], isLoading, refetch } = useQuery({
    queryKey: ['components', selectedCategory, search],
    queryFn: () =>
      componentsApi.list({
        category: selectedCategory ?? undefined,
        q: search || undefined,
      }),
    enabled: open,
  })

  const handleAddClick = (comp: ComponentSummary) => {
    setConfiguringComp(comp)
  }

  const handlePinConfirm = (pins: Record<string, number>, config: Record<string, unknown>) => {
    if (!configuringComp) return
    addComponent({
      uid: crypto.randomUUID(),
      compType: configuringComp.id,
      name: configuringComp.name,
      pins,
      ha_visible: true,
      config,
    })
    setConfiguringComp(null)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Komponente hinzufügen</h2>
            <p className="text-[11px] text-slate-500">
              Wähle eine Komponente und konfiguriere die Pin-Belegung
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-raised hover:text-slate-200 transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-raised hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Suche */}
        <div className="border-b border-border px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sensor, Display, LED …"
              className="w-full rounded-lg border border-border bg-surface-raised pl-9 pr-3 py-2 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-forge-500"
            />
          </div>
        </div>

        {/* Kategorie-Chips */}
        <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              !selectedCategory ? 'bg-forge-600 text-white' : 'bg-surface-raised text-slate-400 hover:text-white',
            )}
          >
            Alle
          </button>
          {categories.filter((c) => c.count > 0).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={clsx(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                selectedCategory === cat.id
                  ? 'bg-forge-600 text-white'
                  : 'bg-surface-raised text-slate-400 hover:text-white',
              )}
            >
              {cat.name}
              <span className="ml-1 opacity-60">{cat.count}</span>
            </button>
          ))}
        </div>

        {/* Komponentenliste */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Laden…</span>
            </div>
          ) : compList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
              <Search className="h-6 w-6 opacity-40" />
              <p className="text-xs">Keine Komponenten gefunden</p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-[11px] text-forge-400 hover:underline"
                >
                  Suche zurücksetzen
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {compList.map((comp) => (
                <DrawerRow key={comp.id} comp={comp} onAdd={() => handleAddClick(comp)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PinConfigurator Modal (über dem Drawer) */}
      {configuringComp && (
        <PinConfigurator
          component={configuringComp}
          onConfirm={handlePinConfirm}
          onCancel={() => setConfiguringComp(null)}
        />
      )}
    </>
  )
}

// ── Einzelne Zeile im Drawer ──────────────────────────────────────────────────

function DrawerRow({ comp, onAdd }: { comp: ComponentSummary; onAdd: () => void }) {
  return (
    <div
      className="group flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 hover:border-border hover:bg-surface-raised transition-colors"
    >
      {/* Icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-slate-400">
        <IconFor name={comp.icon} className="h-4 w-4" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-slate-200">{comp.name}</span>
          {comp.is_custom && (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
              Custom
            </span>
          )}
        </div>
        {comp.description && (
          <p className="truncate text-[11px] text-slate-500">{comp.description}</p>
        )}
      </div>

      {/* Bus */}
      <BusBadge bus={comp.bus_type} />

      {/* Doku */}
      {comp.doc_url && (
        <a
          href={comp.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded p-1 text-slate-600 hover:text-forge-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Dokumentation"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Hinzufügen */}
      <button
        onClick={onAdd}
        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-forge-600/20 hover:text-forge-400 transition-all"
      >
        <Plus className="h-3 w-3" />
        <span className="hidden sm:inline">Hinzufügen</span>
      </button>
    </div>
  )
}
