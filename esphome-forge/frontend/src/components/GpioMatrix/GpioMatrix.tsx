import { useState, useMemo } from 'react'
import clsx from 'clsx'
import type { Board, Gpio } from '@/types/board'
import type { AddedComponent } from '@/store/useProjectStore'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  board: Board
  /** Hinzugefügte Projekt-Komponenten (für Pin-Belegung) */
  components?: AddedComponent[]
}

type FilterMode = 'all' | 'free' | 'comp' | 'used' | 'adc' | 'touch' | 'flash'

const FILTER_LABELS: Record<FilterMode, string> = {
  all:   'Alle',
  free:  'Frei',
  comp:  'Komponenten',
  used:  'Board',
  adc:   'ADC',
  touch: 'Touch',
  flash: 'Flash',
}

// ── Hilfs-Typen ───────────────────────────────────────────────────────────────

interface PinAssignment {
  compName:  string
  compType:  string
  role:      string
}

/** Baut eine Map: GPIO-Nummer → Liste der Zuweisungen */
function buildPinMap(components: AddedComponent[]): Map<number, PinAssignment[]> {
  const map = new Map<number, PinAssignment[]>()
  for (const c of components) {
    for (const [role, gpio] of Object.entries(c.pins)) {
      const list = map.get(gpio) ?? []
      list.push({ compName: c.name, compType: c.compType, role })
      map.set(gpio, list)
    }
  }
  return map
}

type GpioStatus = 'free' | 'comp' | 'comp-conflict' | 'used' | 'flash'

function gpioStatus(
  g: Gpio,
  pinMap: Map<number, PinAssignment[]>,
): GpioStatus {
  if (g.flash) return 'flash'
  const assignments = pinMap.get(g.num)
  if (assignments && assignments.length > 1) return 'comp-conflict'
  if (assignments && assignments.length === 1) return 'comp'
  if (g.board_usage) return 'used'
  return 'free'
}

// ── Status-Farben ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<GpioStatus, string> = {
  free:            'bg-green-900/40 text-green-300',
  comp:            'bg-forge-900/40 text-forge-300',
  'comp-conflict': 'bg-red-900/50 text-red-300 ring-1 ring-red-500/50',
  used:            'bg-orange-900/40 text-orange-300',
  flash:           'bg-red-900/30 text-red-400',
}

// ── Einzelne GPIO-Zeile ───────────────────────────────────────────────────────

function GpioRow({
  g,
  assignments,
  status,
}: {
  g: Gpio
  assignments: PinAssignment[]
  status: GpioStatus
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'cursor-pointer transition-colors text-xs',
          status === 'flash' ? 'opacity-40' : 'hover:bg-surface-overlay',
        )}
      >
        {/* GPIO Nr. */}
        <td className="w-16 py-1.5 pl-3 font-mono font-medium">
          <span className={clsx('rounded px-1.5 py-0.5', STATUS_BADGE[status])}>
            {g.num}
          </span>
        </td>

        {/* Labels */}
        <td className="py-1.5 pr-3">
          <div className="flex flex-wrap gap-1">
            {g.labels.map((l) => (
              <span key={l} className="font-mono text-slate-300">{l}</span>
            ))}
          </div>
        </td>

        {/* Capabilities */}
        <td className="hidden py-1.5 pr-3 sm:table-cell">
          <div className="flex flex-wrap gap-1">
            {g.adc   && <span className="badge badge-blue">ADC{g.adc.unit}{g.adc.wifi_ok ? '' : ' ⚠'}</span>}
            {g.dac   && <span className="badge badge-green">DAC{g.dac.ch}</span>}
            {g.touch && <span className="badge badge-yellow">Touch{g.touch.ch}</span>}
            {g.spi_hw && <span className="badge badge-gray">{g.spi_hw.bus} {g.spi_hw.role}</span>}
            {g.i2c_default && <span className="badge badge-blue">I²C {g.i2c_default}</span>}
            {g.uart_default && <span className="badge badge-gray">UART{g.uart_default.unit} {g.uart_default.role}</span>}
            {g.rtc  && <span className="badge badge-gray">RTC</span>}
            {g.pwm  && <span className="badge badge-gray">PWM</span>}
            {!g.output && g.input && <span className="badge badge-yellow">Input-only</span>}
            {g.strapping && <span className="badge badge-red">Strapping</span>}
            {g.flash && <span className="badge badge-red">Flash</span>}
          </div>
        </td>

        {/* Verwendung */}
        <td className="hidden py-1.5 pr-3 lg:table-cell">
          {assignments.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {assignments.map((a, i) => (
                <span
                  key={i}
                  className={clsx(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    assignments.length > 1
                      ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30'
                      : 'bg-forge-500/20 text-forge-300',
                  )}
                >
                  {a.compName} → {a.role}
                </span>
              ))}
              {assignments.length > 1 && (
                <span className="text-[10px] text-red-400 font-semibold">⚠ Konflikt!</span>
              )}
            </div>
          ) : g.board_usage ? (
            <span className="text-slate-400">{g.board_usage.comp} / {g.board_usage.role}</span>
          ) : g.flash ? (
            <span className="text-red-500">SPI-Flash</span>
          ) : (
            <span className="text-green-500">—</span>
          )}
        </td>
      </tr>

      {/* Detail-Zeile (expandiert) */}
      {open && !g.flash && (
        <tr className="bg-surface-overlay/50">
          <td colSpan={4} className="px-4 py-2 text-xs text-slate-400 space-y-0.5">
            {g.notes      && <p>ℹ {g.notes}</p>}
            {g.strapping  && <p className="text-yellow-400">⚠ Strapping: {g.strapping}</p>}
            {g.board_usage?.note && <p className="text-orange-400">⚠ {g.board_usage.note}</p>}
            {g.adc && !g.adc.wifi_ok && (
              <p className="text-red-400">⚠ ADC2 – wird durch WiFi blockiert!</p>
            )}
            {assignments.length > 1 && (
              <p className="text-red-400 font-medium">
                ⚠ Mehrfachbelegung! Dieser Pin wird von {assignments.length} Komponenten verwendet.
                Bitte eine der Zuweisungen ändern.
              </p>
            )}
            {assignments.length === 1 && (
              <p className="text-forge-300">
                Belegt durch: <strong>{assignments[0].compName}</strong> ({assignments[0].compType}) als {assignments[0].role}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function GpioMatrix({ board, components = [] }: Props) {
  const [filter, setFilter] = useState<FilterMode>('all')

  const pinMap = useMemo(() => buildPinMap(components), [components])

  // Anzahl Konflikte
  const conflictCount = useMemo(() => {
    let count = 0
    for (const [, list] of pinMap) {
      if (list.length > 1) count++
    }
    return count
  }, [pinMap])

  const filtered = board.gpios.filter((g) => {
    const st = gpioStatus(g, pinMap)
    if (filter === 'all')   return true
    if (filter === 'free')  return st === 'free'
    if (filter === 'comp')  return st === 'comp' || st === 'comp-conflict'
    if (filter === 'used')  return st === 'used'
    if (filter === 'flash') return st === 'flash'
    if (filter === 'adc')   return !!g.adc
    if (filter === 'touch') return !!g.touch
    return true
  })

  // Dynamische Zähler
  const compCount = board.gpios.filter(
    (g) => { const s = gpioStatus(g, pinMap); return s === 'comp' || s === 'comp-conflict' },
  ).length

  return (
    <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">GPIO-Matrix</span>
          {conflictCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 ring-1 ring-red-500/30">
              {conflictCount} Konflikt{conflictCount > 1 ? 'e' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'rounded px-2 py-0.5 text-xs transition-colors',
                filter === f ? 'bg-forge-600 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {FILTER_LABELS[f]}
              {f === 'comp' && compCount > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({compCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-slate-500">
              <th className="py-2 pl-3 text-left font-medium">GPIO</th>
              <th className="py-2 pr-3 text-left font-medium">Labels</th>
              <th className="hidden py-2 pr-3 text-left font-medium sm:table-cell">Fähigkeiten</th>
              <th className="hidden py-2 pr-3 text-left font-medium lg:table-cell">Verwendung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((g) => (
              <GpioRow
                key={g.num}
                g={g}
                assignments={pinMap.get(g.num) ?? []}
                status={gpioStatus(g, pinMap)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-2 text-[11px] text-slate-600">
        {filtered.length} von {board.gpios.length} GPIOs
        {compCount > 0 && ` • ${compCount} durch Komponenten belegt`}
        {conflictCount > 0 && (
          <span className="text-red-400 font-medium"> • {conflictCount} Konflikt{conflictCount > 1 ? 'e' : ''}!</span>
        )}
        {' '}• Zeile anklicken für Details
      </p>
    </div>
  )
}
