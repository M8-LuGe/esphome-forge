import { useState } from 'react'
import clsx from 'clsx'
import type { Board, Gpio } from '@/types/board'

interface Props { board: Board }

type FilterMode = 'all' | 'free' | 'used' | 'adc' | 'touch' | 'flash'

const FILTER_LABELS: Record<FilterMode, string> = {
  all:   'Alle',
  free:  'Frei',
  used:  'Belegt',
  adc:   'ADC',
  touch: 'Touch',
  flash: 'Flash',
}

function gpioStatus(g: Gpio): 'free' | 'used' | 'flash' {
  if (g.flash) return 'flash'
  if (g.board_usage) return 'used'
  return 'free'
}

function GpioRow({ g }: { g: Gpio }) {
  const [open, setOpen] = useState(false)
  const status = gpioStatus(g)

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'cursor-pointer transition-colors text-xs',
          status === 'flash' ? 'opacity-40' : 'hover:bg-surface-overlay'
        )}
      >
        {/* GPIO Nr. */}
        <td className="w-16 py-1.5 pl-3 font-mono font-medium">
          <span className={clsx('rounded px-1.5 py-0.5',
            status === 'free'  ? 'bg-green-900/40 text-green-300' :
            status === 'used'  ? 'bg-orange-900/40 text-orange-300' :
                                  'bg-red-900/30 text-red-400'
          )}>
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
        <td className="hidden py-1.5 pr-3 text-slate-400 lg:table-cell">
          {g.board_usage
            ? <span>{g.board_usage.comp} / {g.board_usage.role}</span>
            : g.flash
              ? <span className="text-red-500">SPI-Flash</span>
              : <span className="text-green-500">—</span>
          }
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
          </td>
        </tr>
      )}
    </>
  )
}

export function GpioMatrix({ board }: Props) {
  const [filter, setFilter] = useState<FilterMode>('all')

  const filtered = board.gpios.filter((g) => {
    if (filter === 'all')   return true
    if (filter === 'free')  return !g.flash && !g.board_usage
    if (filter === 'used')  return !!g.board_usage
    if (filter === 'flash') return !!g.flash
    if (filter === 'adc')   return !!g.adc
    if (filter === 'touch') return !!g.touch
    return true
  })

  return (
    <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">GPIO-Matrix</span>
        <div className="flex gap-1">
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'rounded px-2 py-0.5 text-xs transition-colors',
                filter === f ? 'bg-forge-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {FILTER_LABELS[f]}
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
              <th className="hidden py-2 pr-3 text-left font-medium lg:table-cell">Board-Verwendung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((g) => (
              <GpioRow key={g.num} g={g} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-slate-600">
        {filtered.length} von {board.gpios.length} GPIOs • Zeile anklicken für Details
      </p>
    </div>
  )
}
