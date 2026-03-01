import { Wifi, Bluetooth, Usb, Monitor, Hand, Check } from 'lucide-react'
import clsx from 'clsx'
import type { BoardSummary } from '@/types/board'

interface Props {
  board: BoardSummary
  selected?: boolean
  onClick: () => void
}

const FAMILY_COLOR: Record<string, string> = {
  'ESP32':    'text-blue-400 bg-blue-900/30 ring-blue-700/40',
  'ESP32-S2': 'text-purple-400 bg-purple-900/30 ring-purple-700/40',
  'ESP32-S3': 'text-violet-400 bg-violet-900/30 ring-violet-700/40',
  'ESP32-C3': 'text-green-400 bg-green-900/30 ring-green-700/40',
  'ESP32-C6': 'text-teal-400 bg-teal-900/30 ring-teal-700/40',
  'ESP32-H2': 'text-pink-400 bg-pink-900/30 ring-pink-700/40',
  'ESP8266':  'text-orange-400 bg-orange-900/30 ring-orange-700/40',
}

/** Board-Zeile für die Listen-Ansicht */
export function BoardListRow({ board, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-all',
        selected
          ? 'border-forge-500 bg-forge-900/20 ring-1 ring-forge-500/50'
          : 'border-border bg-surface-raised hover:border-forge-700 hover:bg-surface-overlay'
      )}
    >
      {/* ── Auswahl-Indikator ── */}
      <div className={clsx(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
        selected
          ? 'border-forge-500 bg-forge-500'
          : 'border-slate-600 group-hover:border-slate-400'
      )}>
        {selected && <Check className="h-3 w-3 text-white" />}
      </div>

      {/* ── Name + Hersteller ── */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight truncate">{board.name}</p>
        {board.manufacturer && (
          <p className="mt-0.5 text-xs text-slate-500 truncate">{board.manufacturer}</p>
        )}
      </div>

      {/* ── Chip-Familie Pill ── */}
      <span className={clsx(
        'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-medium ring-1',
        FAMILY_COLOR[board.chip_family] ?? 'text-slate-400 bg-slate-800 ring-slate-700/40'
      )}>
        {board.chip_family}
      </span>

      {/* ── Specs ── */}
      <div className="hidden shrink-0 items-center gap-4 text-xs text-slate-400 sm:flex">
        <span className="w-16 text-right font-mono">{board.cpu_mhz} MHz</span>
        <span className="w-20 text-right font-mono">{board.ram_kb} KB RAM</span>
        <span className="w-20 text-right font-mono">{board.flash_mb} MB Flash</span>
      </div>

      {/* ── GPIO-Zähler ── */}
      <div className="shrink-0 text-right">
        <span className="text-xs font-mono">
          <span className="text-green-400">{board.free_gpio_count}</span>
          <span className="text-slate-600">/{board.gpio_count}</span>
        </span>
        <p className="text-[10px] text-slate-600">GPIO frei</p>
      </div>

      {/* ── Feature-Icons ── */}
      <div className="hidden shrink-0 items-center gap-1.5 md:flex">
        {board.wifi       && <Wifi      className="h-3.5 w-3.5 text-sky-400"    title="WiFi" />}
        {board.bluetooth  && <Bluetooth className="h-3.5 w-3.5 text-blue-400"   title={board.bluetooth ?? 'Bluetooth'} />}
        {board.usb_native && <Usb       className="h-3.5 w-3.5 text-green-400"  title="Native USB" />}
        {board.has_display && <Monitor  className="h-3.5 w-3.5 text-orange-400" title="Display onboard" />}
        {board.has_touch  && <Hand      className="h-3.5 w-3.5 text-yellow-400" title="Touch onboard" />}
        {board.psram_mb ? (
          <span className="rounded bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-300 ring-1 ring-blue-700/40">
            PSRAM
          </span>
        ) : null}
      </div>
    </button>
  )
}
