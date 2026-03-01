import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  Check,
  ExternalLink,
  Loader2,
  Cpu,
} from 'lucide-react'
import clsx from 'clsx'
import { componentsApi } from '@/api/components'
import { useProjectStore } from '@/store/useProjectStore'
import type { ComponentSummary, ComponentDetail, ConfigField } from '@/types/component'
import type { Gpio } from '@/types/board'

// ── Props ─────────────────────────────────────────────────────────────────────

interface PinConfiguratorProps {
  component: ComponentSummary
  onConfirm: (pins: Record<string, number>, config: Record<string, unknown>) => void
  onCancel: () => void
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Prüft ob ein GPIO die benötigten Modi erfüllt */
function gpioMatchesModes(gpio: Gpio, modes: string[]): boolean {
  if (!modes || modes.length === 0) return true
  for (const mode of modes) {
    switch (mode) {
      case 'input':    if (!gpio.input)   return false; break
      case 'output':   if (!gpio.output)  return false; break
      case 'pullup':   if (!gpio.pu)      return false; break
      case 'pulldown': if (!gpio.pd)      return false; break
      case 'adc':      if (!gpio.adc)     return false; break
      case 'pwm':      if (!gpio.pwm)     return false; break
      case 'touch':    if (!gpio.touch)   return false; break
    }
  }
  return true
}

/** Prüft ob ein GPIO bereits von Board-Builtin oder anderem Component belegt ist */
function gpioIsUsed(
  gpio: Gpio,
  usedPins: Set<number>,
): boolean {
  if (gpio.board_usage) return true
  if (gpio.flash) return true
  if (usedPins.has(gpio.num)) return true
  return false
}

/** Gibt eine lesbare Beschreibung des GPIO zurück */
function gpioLabel(gpio: Gpio): string {
  const labels = gpio.labels.filter(l => l !== `GPIO${gpio.num}`)
  return labels.length > 0 ? `GPIO${gpio.num} (${labels[0]})` : `GPIO${gpio.num}`
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function PinConfigurator({ component, onConfirm, onCancel }: PinConfiguratorProps) {
  const { selectedBoard, components } = useProjectStore()

  // Detail-Daten (inkl. config_fields mit pin_modes) laden
  const { data: detail, isLoading } = useQuery({
    queryKey: ['component-detail', component.id],
    queryFn: () => componentsApi.get(component.id),
  })

  // Pin-Felder extrahieren
  const pinFields = useMemo(
    () => (detail?.config_fields ?? []).filter((f) => f.type === 'pin'),
    [detail],
  )

  // Config-Felder (nicht-Pin)
  const configFields = useMemo(
    () =>
      (detail?.config_fields ?? []).filter(
        (f) => f.type !== 'pin' && f.type !== 'schema' && f.type !== 'use_id' && f.required,
      ),
    [detail],
  )

  // State: Pin-Zuweisungen + Config
  const [pinAssignments, setPinAssignments] = useState<Record<string, number>>({})
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})

  // Bereits belegte Pins (von anderen Komponenten im Projekt)
  const usedPins = useMemo(() => {
    const used = new Set<number>()
    for (const c of components) {
      for (const gpio of Object.values(c.pins)) {
        used.add(gpio)
      }
    }
    return used
  }, [components])

  // GPIOs aus dem Board
  const gpios = selectedBoard?.gpios ?? []

  // Bereits zugewiesene Bus-Pins (SDA/SCL/CLK/MOSI etc.) aus dem Projekt ermitteln
  // → I²C/SPI Komponenten teilen sich dieselben Bus-Pins
  const existingBusPins = useMemo(() => {
    const busPinKeys = ['sda', 'scl', 'clk_pin', 'mosi_pin', 'miso_pin']
    const pins: Record<string, number> = {}
    for (const c of components) {
      for (const key of busPinKeys) {
        if (c.pins[key] !== undefined && !(key in pins)) {
          pins[key] = c.pins[key]
        }
      }
    }
    return pins
  }, [components])

  // Auto-Assign beim ersten Laden der Detail-Daten
  const autoAssignedRef = useRef(false)
  useEffect(() => {
    if (!detail || autoAssignedRef.current || pinFields.length === 0) return
    autoAssignedRef.current = true

    // GPIOs sortieren: Nicht-Strapping-Pins zuerst, dann Strapping-Pins (letzter Ausweg)
    const sorted = [...gpios].sort((a, b) => {
      const aStrap = a.strapping ? 1 : 0
      const bStrap = b.strapping ? 1 : 0
      return aStrap - bStrap
    })

    const auto: Record<string, number> = {}
    const localUsed = new Set<number>(usedPins)

    for (const field of pinFields) {
      if (!field.required) continue

      // Bus-Pin mit existierender Zuweisung wiederverwenden (I²C/SPI geteilt)
      if (field.key in existingBusPins) {
        auto[field.key] = existingBusPins[field.key]
        // Kein localUsed.add – geteilter Pin darf mehrfach vorkommen
        continue
      }

      const modes = field.pin_modes ?? []
      const candidate = sorted.find(
        (g) => gpioMatchesModes(g, modes) && !gpioIsUsed(g, localUsed),
      )
      if (candidate) {
        auto[field.key] = candidate.num
        localUsed.add(candidate.num) // Für nachfolgende Felder reservieren
      }
    }

    if (Object.keys(auto).length > 0) {
      setPinAssignments(auto)
    }
  }, [detail]) // eslint-disable-line react-hooks/exhaustive-deps

  // Config-Defaults beim Laden initialisieren
  useEffect(() => {
    if (!detail) return
    const defaults: Record<string, unknown> = {}
    for (const field of detail.config_fields) {
      if (field.default !== undefined && field.default !== null && field.default !== '') {
        defaults[field.key] = field.type === 'integer' ? Number(field.default) : field.default
      }
    }
    setConfigValues(defaults)
  }, [detail])

  // Validierung: alle Required-Pin-Felder zugewiesen?
  const allRequiredPinsSet = pinFields
    .filter((f) => f.required)
    .every((f) => pinAssignments[f.key] !== undefined)

  const handleConfirm = () => {
    onConfirm(pinAssignments, configValues)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-forge-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-200">{component.name}</h2>
              <p className="text-xs text-slate-500">Pin-Zuweisung konfigurieren</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-raised hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Lade Konfigurationsfelder…</span>
            </div>
          ) : pinFields.length === 0 && configFields.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              Diese Komponente benötigt keine Pin-Konfiguration.
              {component.bus_type === 'i2c' && (
                <p className="mt-2 text-xs text-slate-600">
                  I²C-Adresse wird automatisch konfiguriert. Bus-Pins (SDA/SCL) werden
                  aus der Board-Konfiguration übernommen.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Pin-Felder */}
              {pinFields.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    GPIO-Zuweisungen
                  </h3>
                  {pinFields.map((field) => (
                    <PinFieldRow
                      key={field.key}
                      field={field}
                      gpios={gpios}
                      usedPins={usedPins}
                      currentPins={pinAssignments}
                      value={pinAssignments[field.key]}
                      onChange={(gpio) =>
                        setPinAssignments((prev) => {
                          if (gpio === undefined) {
                            const { [field.key]: _, ...rest } = prev
                            return rest
                          }
                          return { ...prev, [field.key]: gpio }
                        })
                      }
                    />
                  ))}
                </div>
              )}

              {/* Config-Felder (required) */}
              {configFields.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Konfiguration
                  </h3>
                  {configFields.map((field) => (
                    <ConfigFieldRow
                      key={field.key}
                      field={field}
                      value={configValues[field.key]}
                      onChange={(val) =>
                        setConfigValues((prev) => ({ ...prev, [field.key]: val }))
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Doku-Link */}
          {component.doc_url && (
            <a
              href={component.doc_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-forge-400 hover:text-forge-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              ESPHome Dokumentation
            </a>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:bg-surface-raised hover:text-slate-200 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allRequiredPinsSet && pinFields.some((f) => f.required)}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all',
              allRequiredPinsSet || !pinFields.some((f) => f.required)
                ? 'bg-forge-600 text-white hover:bg-forge-500'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            )}
          >
            <Check className="h-3.5 w-3.5" />
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pin-Feld-Zeile ────────────────────────────────────────────────────────────

function PinFieldRow({
  field,
  gpios,
  usedPins,
  currentPins,
  value,
  onChange,
}: {
  field: ConfigField
  gpios: Gpio[]
  usedPins: Set<number>
  currentPins: Record<string, number>
  value: number | undefined
  onChange: (gpio: number | undefined) => void
}) {
  // Aktuelle Zuweisungen DIESES Dialogs (ohne das aktuelle Feld)
  const localUsed = useMemo(() => {
    const s = new Set(usedPins)
    for (const [k, v] of Object.entries(currentPins)) {
      if (k !== field.key) s.add(v)
    }
    return s
  }, [usedPins, currentPins, field.key])

  const modes = field.pin_modes ?? []

  // Verfügbare GPIOs: passende Modi + nicht belegt
  const available = useMemo(
    () =>
      gpios.filter(
        (g) => gpioMatchesModes(g, modes) && !gpioIsUsed(g, localUsed),
      ),
    [gpios, modes, localUsed],
  )

  // Alle GPIOs die die Modi erfüllen (für disabled-Hinweis)
  const compatible = useMemo(
    () => gpios.filter((g) => gpioMatchesModes(g, modes)),
    [gpios, modes],
  )

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-300">
          {field.description ?? field.key}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
          <span className="ml-1.5 font-mono text-[9px] text-slate-600">{field.key}</span>
        </label>
        {modes.length > 0 && (
          <span className="text-[10px] text-slate-600">
            ({modes.join(', ')})
          </span>
        )}
      </div>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? undefined : Number(v))
        }}
        className={clsx(
          'w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-forge-500',
          value !== undefined ? 'border-forge-500/40 text-slate-200' : 'border-border text-slate-400',
        )}
      >
        <option value="">— GPIO wählen —</option>
        {available.map((g) => (
          <option key={g.num} value={g.num}>
            {gpioLabel(g)}
            {g.strapping ? ' ⚠' : ''}
            {g.adc ? ' [ADC]' : ''}
            {g.touch ? ' [Touch]' : ''}
            {g.pwm ? ' [PWM]' : ''}
          </option>
        ))}
      </select>
      {field.description && (
        <p className="text-[10px] text-slate-600 leading-relaxed">
          {field.description.replace(/\*\*.*?\*\*/g, '').replace(/\[.*?\]\(.*?\)/g, '').slice(0, 120)}
        </p>
      )}
      {available.length === 0 && compatible.length > 0 && (
        <p className="text-[10px] text-amber-400">
          Alle kompatiblen GPIOs sind bereits belegt.
        </p>
      )}
    </div>
  )
}

// ── Config-Feld-Zeile ─────────────────────────────────────────────────────────

function ConfigFieldRow({
  field,
  value,
  onChange,
}: {
  field: ConfigField
  value: unknown
  onChange: (val: unknown) => void
}) {
  if (field.type === 'enum' && field.enum_values) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-300">
          {field.description ?? field.key}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <select
          value={(value as string) ?? field.default ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-forge-500"
        >
          <option value="">— Auswählen —</option>
          {field.enum_values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-surface-raised text-forge-600 focus:ring-forge-500"
        />
        <label className="text-xs font-medium text-slate-300">{field.description ?? field.key}</label>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-300">
        {field.description ?? field.key}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={field.type === 'integer' ? 'number' : 'text'}
        value={(value as string) ?? field.default ?? ''}
        onChange={(e) => onChange(field.type === 'integer' ? Number(e.target.value) : e.target.value)}
        placeholder={field.default ?? ''}
        className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-forge-500"
      />
    </div>
  )
}
