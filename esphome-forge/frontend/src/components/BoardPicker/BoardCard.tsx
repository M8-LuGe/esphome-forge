import { Cpu, Wifi, Bluetooth, Usb, Monitor, Hand } from 'lucide-react'
import clsx from 'clsx'
import type { BoardSummary } from '@/types/board'

interface Props {
  board: BoardSummary
  selected?: boolean
  onClick: () => void
}

const FAMILY_COLOR: Record<string, string> = {
  'ESP32':    'text-blue-400',
  'ESP32-S2': 'text-purple-400',
  'ESP32-S3': 'text-violet-400',
  'ESP32-C3': 'text-green-400',
  'ESP32-C6': 'text-teal-400',
  'ESP32-H2': 'text-pink-400',
  'ESP8266':  'text-orange-400',
}

export function BoardCard({ board, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all',
        selected
          ? 'border-forge-500 bg-forge-900/20 ring-1 ring-forge-500/50'
          : 'border-border bg-surface-raised hover:border-forge-700 hover:bg-surface-overlay'
      )}
    >
      {/* ── Board-Bild oder Fallback ── */}
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-black/30">
        {board.image_url ? (
          <img
            src={board.image_url}
            alt={board.name}
            className="h-full w-full object-contain p-1"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <Cpu className="h-10 w-10 text-slate-600" />
        )}
      </div>

      {/* ── Name + Familie ── */}
      <div>
        <p className="text-sm font-semibold leading-tight">{board.name}</p>
        {board.manufacturer && (
          <p className="mt-0.5 text-xs text-slate-500 truncate">{board.manufacturer}</p>
        )}
        <span className={clsx('mt-1 text-xs font-mono font-medium', FAMILY_COLOR[board.chip_family] ?? 'text-slate-400')}>
          {board.chip_family}
        </span>
      </div>

      {/* ── Specs ── */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-400">
        <span>{board.cpu_mhz} MHz</span>
        <span>{board.ram_kb} KB RAM</span>
        <span>{board.flash_mb} MB Flash</span>
        <span>{board.free_gpio_count}/{board.gpio_count} GPIO frei</span>
      </div>

      {/* ── Feature-Icons ── */}
      <div className="flex flex-wrap gap-1.5">
        {board.wifi       && <Wifi      className="h-3.5 w-3.5 text-sky-400"    title="WiFi" />}
        {board.bluetooth  && <Bluetooth className="h-3.5 w-3.5 text-blue-400"   title={board.bluetooth} />}
        {board.usb_native && <Usb       className="h-3.5 w-3.5 text-green-400"  title="Native USB" />}
        {board.has_display && <Monitor  className="h-3.5 w-3.5 text-orange-400" title="Display onboard" />}
        {board.has_touch  && <Hand      className="h-3.5 w-3.5 text-yellow-400" title="Touch onboard" />}
        {board.psram_mb   && (
          <span className="badge badge-blue">PSRAM {board.psram_mb}MB</span>
        )}
      </div>

      {selected && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-forge-500">
          <span className="text-[10px] text-white">✓</span>
        </div>
      )}
    </button>
  )
}
