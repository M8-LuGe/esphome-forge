import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wifi,
  WifiOff,
  Upload,
  Play,
  Search,
  Key,
  Lock,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Terminal,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Globe,
} from 'lucide-react'
import clsx from 'clsx'
import { esphomeApi, projectsApi } from '@/api/projects'
import type { EsphomeStatus, ActionResult } from '@/types/project'
import { useProjectStore } from '@/store/useProjectStore'

/* ── Kopier-Button (api_key / ota_password) ─────────────────────────────── */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [value])

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-lg bg-surface-overlay px-2.5 py-1.5 text-[11px] font-mono text-slate-300 hover:bg-surface-raised transition-colors group"
      title={`${label} kopieren`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3 text-slate-500 group-hover:text-slate-300" />
      )}
      <span className="truncate max-w-[180px]">{value || '—'}</span>
    </button>
  )
}

/* ── Log-Viewer ─────────────────────────────────────────────────────────── */
function LogViewer({ projectId, visible }: { projectId: string; visible: boolean }) {
  const [lines, setLines] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return

    const url = esphomeApi.logsUrl(projectId)
    const source = new EventSource(url)

    source.onmessage = (event) => {
      setLines((prev) => [...prev.slice(-500), event.data])
    }

    source.onerror = () => {
      setLines((prev) => [...prev, '--- Stream beendet ---'])
      source.close()
    }

    return () => source.close()
  }, [projectId, visible])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      className="max-h-48 overflow-auto rounded-lg bg-black/40 border border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-green-400"
    >
      {lines.length === 0 && (
        <span className="text-slate-500">Warte auf Logs…</span>
      )}
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  )
}

/* ── Haupt-Komponente ──────────────────────────────────────────────────── */
export function DevicePanel() {
  const { activeProject } = useProjectStore()
  const queryClient = useQueryClient()

  const [showLogs, setShowLogs] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [lastResult, setLastResult] = useState<ActionResult | null>(null)

  const projectId = activeProject?.id
  const device = activeProject?.device

  // ESPHome-Addon-Status
  const { data: esphomeStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['esphome-status'],
    queryFn: esphomeApi.status,
    staleTime: 30_000,
    retry: 1,
  })

  // Device-Info mit Online-Status
  const { data: deviceInfo, refetch: refetchDevice } = useQuery({
    queryKey: ['device-info', projectId],
    queryFn: () => esphomeApi.getDevice(projectId!),
    enabled: !!projectId,
    refetchInterval: 30_000,
  })

  // Compile
  const compileMutation = useMutation({
    mutationFn: () => esphomeApi.compile(projectId!),
    onSuccess: (result) => {
      setLastResult(result)
      if (result.success) setShowLogs(true)
      queryClient.invalidateQueries({ queryKey: ['device-info', projectId] })
    },
    onError: (err: Error) => setLastResult({ success: false, error: err.message }),
  })

  // Upload
  const uploadMutation = useMutation({
    mutationFn: () => esphomeApi.upload(projectId!, deviceInfo?.device_ip ?? undefined),
    onSuccess: (result) => {
      setLastResult(result)
      if (result.success) setShowLogs(true)
      queryClient.invalidateQueries({ queryKey: ['device-info', projectId] })
    },
    onError: (err: Error) => setLastResult({ success: false, error: err.message }),
  })

  // Discover
  const discoverMutation = useMutation({
    mutationFn: () => esphomeApi.discover(projectId!),
    onSuccess: (result) => {
      if (result.found) {
        setLastResult({ success: true, message: `Device gefunden: ${result.ip}` })
        refetchDevice()
      } else {
        setLastResult({ success: false, error: 'Device nicht gefunden' })
      }
    },
  })

  if (!projectId || !device) return null

  const isOnline = deviceInfo?.online ?? false
  const compileStatus = deviceInfo?.compile_status ?? device.compile_status
  const isBusy = compileMutation.isPending || uploadMutation.isPending

  const esphomeAvailable = esphomeStatus?.esphome_running ?? false

  return (
    <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          {isOnline ? (
            <div className="flex items-center gap-1.5 text-green-400">
              <Wifi className="h-4 w-4" />
              <span className="text-xs font-medium">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-500">
              <WifiOff className="h-4 w-4" />
              <span className="text-xs font-medium">Offline</span>
            </div>
          )}

          {deviceInfo?.device_ip && (
            <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-[10px] font-mono text-slate-400">
              {deviceInfo.device_ip}
            </span>
          )}

          {compileStatus && compileStatus !== 'none' && (
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                compileStatus === 'compiled' && 'bg-green-500/10 text-green-400',
                compileStatus === 'compiling' && 'bg-yellow-500/10 text-yellow-400',
                compileStatus === 'error' && 'bg-red-500/10 text-red-400',
              )}
            >
              {compileStatus === 'compiled' && 'Kompiliert'}
              {compileStatus === 'compiling' && 'Kompiliert…'}
              {compileStatus === 'error' && 'Fehler'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Discover Button */}
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={isBusy || discoverMutation.isPending}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-slate-400 hover:bg-surface-overlay hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Device suchen"
          >
            {discoverMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            Suchen
          </button>

          {/* Compile Button */}
          <button
            onClick={() => compileMutation.mutate()}
            disabled={isBusy || !esphomeAvailable}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
              esphomeAvailable
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed',
            )}
            title={esphomeAvailable ? 'Kompilieren' : 'ESPHome-Addon nicht verfügbar'}
          >
            {compileMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Kompilieren
          </button>

          {/* Upload Button */}
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={isBusy || !esphomeAvailable || compileStatus !== 'compiled'}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
              esphomeAvailable && compileStatus === 'compiled'
                ? 'bg-forge-600 text-white hover:bg-forge-500'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed',
            )}
            title={
              !esphomeAvailable
                ? 'ESPHome-Addon nicht verfügbar'
                : compileStatus !== 'compiled'
                  ? 'Zuerst kompilieren'
                  : 'Per OTA flashen'
            }
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Flashen
          </button>
        </div>
      </div>

      {/* ESPHome Status Warning */}
      {!statusLoading && !esphomeAvailable && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-900/20 border-b border-yellow-800/30 text-xs text-yellow-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {esphomeStatus?.supervisor_available
              ? 'ESPHome-Addon nicht installiert oder nicht gestartet.'
              : 'Keine Supervisor-Verbindung — Compile/Flash nur in HA-Addon-Umgebung verfügbar.'}
          </span>
        </div>
      )}

      {/* Result Message */}
      {lastResult && (
        <div
          className={clsx(
            'flex items-center gap-2 px-4 py-2 text-xs border-b border-border',
            lastResult.success ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300',
          )}
        >
          {lastResult.success ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>{lastResult.message || lastResult.error}</span>
          <button onClick={() => setLastResult(null)} className="ml-auto text-slate-500 hover:text-slate-300">✕</button>
        </div>
      )}

      {/* Details Row */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[11px]">
          {/* API Key + OTA Password */}
          <button
            onClick={() => setShowSecrets(!showSecrets)}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Key className="h-3 w-3" />
            <span>Secrets</span>
            {showSecrets ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {/* mDNS */}
          {device.mdns_name && (
            <span className="flex items-center gap-1 text-slate-500">
              <Globe className="h-3 w-3" />
              {device.mdns_name}
            </span>
          )}

          {/* Letzte Aktivität */}
          {deviceInfo?.last_seen && (
            <span className="text-slate-600">
              Zuletzt: {new Date(deviceInfo.last_seen).toLocaleString('de-DE')}
            </span>
          )}
        </div>

        {/* Logs Toggle */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className={clsx(
            'flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors',
            showLogs
              ? 'bg-forge-600/20 text-forge-400'
              : 'text-slate-500 hover:bg-surface-overlay hover:text-slate-300',
          )}
        >
          <Terminal className="h-3 w-3" />
          Logs
        </button>
      </div>

      {/* Secrets Panel */}
      {showSecrets && (
        <div className="px-4 pb-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500 w-16">API Key</span>
            <CopyButton value={device.api_key} label="API Key" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500 w-16">OTA PW</span>
            <CopyButton value={device.ota_password} label="OTA Passwort" />
          </div>
        </div>
      )}

      {/* Log Stream */}
      {showLogs && (
        <div className="px-4 pb-3">
          <LogViewer projectId={projectId} visible={showLogs} />
        </div>
      )}
    </div>
  )
}
