import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, AlertTriangle, PlusCircle } from 'lucide-react'
import { boardsApi } from '@/api/boards'
import { useProjectStore } from '@/store/useProjectStore'
import { BoardCard } from './BoardCard'
import type { ChipFamily } from '@/types/board'

const FAMILIES: ChipFamily[] = ['ESP32', 'ESP32-S2', 'ESP32-S3', 'ESP32-C3', 'ESP32-C6', 'ESP32-H2', 'ESP8266']

export function BoardPicker() {
  const { selectedBoardSummary, setSelectedBoard, searchQuery, setSearchQuery, filterFamily, setFilterFamily } = useProjectStore()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data: boards, isLoading, error } = useQuery({
    queryKey: ['boards', filterFamily],
    queryFn:  () => boardsApi.list(filterFamily ?? undefined),
  })

  const filtered = boards?.filter((b) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      b.name.toLowerCase().includes(q) ||
      b.chip_family.toLowerCase().includes(q) ||
      b.chip_model.toLowerCase().includes(q) ||
      b.aliases?.some((a) => a.toLowerCase().includes(q))
    )
  }) ?? []

  const handleSelect = async (id: string) => {
    const summary = boards?.find((b) => b.id === id)
    if (!summary) return
    setPendingId(id)
    try {
      const full = await boardsApi.get(id)
      setSelectedBoard(summary, full)
    } catch {
      setSelectedBoard(summary)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold">Board auswählen</h1>
        <p className="mt-1 text-sm text-slate-400">
          Wähle dein ESP-Board. Die GPIO-Matrix und bekannte Built-in-Komponenten werden automatisch geladen.
        </p>
      </div>

      {/* ── Filter-Bar ── */}
      <div className="flex flex-wrap gap-3">
        {/* Suche */}
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Name, Alias, Chip…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-overlay pl-9 pr-3 py-2 text-sm placeholder:text-slate-600 focus:border-forge-500 focus:outline-none focus:ring-1 focus:ring-forge-500"
          />
        </div>

        {/* Chip-Familie Filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterFamily(null)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterFamily === null ? 'bg-forge-600 text-white' : 'bg-surface-overlay text-slate-400 hover:text-white'}`}
          >
            Alle
          </button>
          {FAMILIES.map((f) => (
            <button
              key={f}
              onClick={() => setFilterFamily(f === filterFamily ? null : f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterFamily === f ? 'bg-forge-600 text-white' : 'bg-surface-overlay text-slate-400 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Board-Grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Boards laden…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Fehler beim Laden: {(error as Error).message}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">{filtered.length} Board{filtered.length !== 1 ? 's' : ''} gefunden</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((b) => (
              <div key={b.id} className="relative">
                <BoardCard
                  board={b}
                  selected={selectedBoardSummary?.id === b.id}
                  onClick={() => handleSelect(b.id)}
                />
                {pendingId === b.id && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                    <Loader2 className="h-6 w-6 animate-spin text-forge-400" />
                  </div>
                )}
              </div>
            ))}

            {/* Custom Board anlegen */}
            <button className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-slate-600 transition-colors hover:border-forge-700 hover:text-forge-500">
              <PlusCircle className="h-7 w-7" />
              <span className="text-xs">Custom Board</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
