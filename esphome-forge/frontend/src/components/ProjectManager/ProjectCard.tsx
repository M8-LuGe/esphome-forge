import { Cpu, Calendar, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { DeviceListItem } from '@/types/project'

const FAMILY_COLOR: Record<string, string> = {
  'ESP32':    'text-blue-400',
  'ESP32-S2': 'text-purple-400',
  'ESP32-S3': 'text-violet-400',
  'ESP32-C3': 'text-green-400',
  'ESP32-C6': 'text-teal-400',
  'ESP32-H2': 'text-pink-400',
  'ESP8266':  'text-orange-400',
}

interface Props {
  device: DeviceListItem
  onClick: () => void
  onDelete?: () => void
}

export function ProjectCard({ device, onClick, onDelete }: Props) {
  const isForge = device.created_by_forge
  const dateStr = device.created_at
    ? new Date(device.created_at).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : null

  return (
    <button
      onClick={isForge ? onClick : undefined}
      disabled={!isForge}
      className={clsx(
        'group relative flex h-full flex-col gap-3 rounded-xl border p-4 text-left transition-all',
        isForge
          ? 'border-border bg-surface-raised hover:border-forge-700 hover:bg-surface-overlay cursor-pointer'
          : 'border-border/50 bg-surface-raised/50 cursor-not-allowed opacity-50'
      )}
    >
      {/* ── Icon + Name ── */}
      <div className="flex items-start gap-3">
        <div className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          isForge ? 'bg-forge-900/40' : 'bg-slate-800'
        )}>
          <Cpu className={clsx('h-5 w-5', isForge ? 'text-forge-400' : 'text-slate-600')} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{device.name}</p>
          {device.board_name && (
            <p className="mt-0.5 text-xs text-slate-400 truncate">{device.board_name}</p>
          )}
        </div>
      </div>

      {/* ── Chip-Familie ── */}
      {device.chip_family && (
        <span className={clsx(
          'text-xs font-mono font-medium',
          FAMILY_COLOR[device.chip_family] ?? 'text-slate-400'
        )}>
          {device.chip_family}
        </span>
      )}

      {/* ── Spacer für gleichmäßige Höhe ── */}
      <div className="flex-1" />

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          {isForge ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-forge-900/40 px-2 py-0.5 text-forge-300 ring-1 ring-forge-700/40">
              Forge
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-slate-500 ring-1 ring-slate-700/40">
              Extern
            </span>
          )}
          {device.yaml_exists && (
            <span className="text-green-500" title="YAML vorhanden">●</span>
          )}
        </div>
        {dateStr && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {dateStr}
          </span>
        )}
      </div>

      {/* ── Löschen-Button (nur Forge) ── */}
      {isForge && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute right-2 top-2 rounded p-1 text-slate-600 opacity-0 transition-all hover:bg-red-900/30 hover:text-red-400 group-hover:opacity-100"
          title="Projekt löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* ── Nicht von Forge ── */}
      {!isForge && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl">
          <span className="rounded-lg bg-black/60 px-3 py-1.5 text-xs text-slate-400">
            Nicht von Forge verwaltet
          </span>
        </div>
      )}
    </button>
  )
}
