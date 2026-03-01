import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, AlertTriangle, PlusCircle, ArrowLeft, Check } from 'lucide-react'
import { boardsApi } from '@/api/boards'
import { projectsApi } from '@/api/projects'
import { useProjectStore } from '@/store/useProjectStore'
import { BoardListRow } from './BoardCard'
import type { ChipFamily } from '@/types/board'

const FAMILIES: ChipFamily[] = ['ESP32', 'ESP32-S2', 'ESP32-S3', 'ESP32-C3', 'ESP32-C6', 'ESP32-H2', 'ESP8266']

export function BoardPicker() {
  const {
    selectedBoardSummary, setSelectedBoard,
    searchQuery, setSearchQuery,
    filterFamily, setFilterFamily,
    pendingProjectName, setPendingProjectName,
    confirmProjectCreated, clearProject,
  } = useProjectStore()

  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState(pendingProjectName ?? '')
  const [nameError, setNameError] = useState<string | null>(null)

  const isCreateMode = pendingProjectName !== null

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
      (b.chip_model?.toLowerCase().includes(q)) ||
      b.aliases?.some((a) => a.toLowerCase().includes(q))
    )
  }) ?? []

  // ── Board auswählen (nur Preview, noch kein Navigieren) ──
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

  // ── Projekt erstellen ──
  const createMutation = useMutation({
    mutationFn: (data: { name: string; board_id: string }) =>
      projectsApi.create(data),
    onSuccess: async (project) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      // Board-Daten laden
      const board = await boardsApi.get(project.board_id)
      const summary = boards?.find((b) => b.id === project.board_id)
      if (summary) {
        confirmProjectCreated(project, summary, board)
      }
    },
  })

  const handleCreateProject = () => {
    const name = projectName.trim()
    if (!name) {
      setNameError('Bitte einen Projektnamen eingeben.')
      return
    }
    if (name.length < 2) {
      setNameError('Name muss mindestens 2 Zeichen lang sein.')
      return
    }
    if (!selectedBoardSummary) {
      setNameError('Bitte ein Board auswählen.')
      return
    }
    setNameError(null)
    createMutation.mutate({ name, board_id: selectedBoardSummary.id })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            {isCreateMode ? 'Neues Projekt – Board auswählen' : 'Board auswählen'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isCreateMode
              ? 'Gib deinem Projekt einen Namen und wähle ein ESP-Board. Das ESPHome-YAML wird automatisch erstellt.'
              : 'Wähle dein ESP-Board. Die GPIO-Matrix und bekannte Built-in-Komponenten werden automatisch geladen.'
            }
          </p>
        </div>
        {isCreateMode && (
          <button
            onClick={clearProject}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Abbrechen
          </button>
        )}
      </div>

      {/* ── Projektname (nur im Create-Modus) ── */}
      {isCreateMode && (
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
          <label className="block text-sm font-medium text-slate-300">Projektname</label>
          <input
            type="text"
            placeholder="z.B. Wohnzimmer Sensor, Garten Bewässerung…"
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value)
              setPendingProjectName(e.target.value)
              setNameError(null)
            }}
            className="w-full max-w-md rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm placeholder:text-slate-600 focus:border-forge-500 focus:outline-none focus:ring-1 focus:ring-forge-500"
            autoFocus
          />
          {nameError && <p className="text-xs text-red-400">{nameError}</p>}
        </div>
      )}

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
          <div className="flex flex-col gap-2">
            {filtered.map((b) => (
              <div key={b.id} className="relative">
                <BoardListRow
                  board={b}
                  selected={selectedBoardSummary?.id === b.id}
                  onClick={() => handleSelect(b.id)}
                />
                {pendingId === b.id && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                    <Loader2 className="h-5 w-5 animate-spin text-forge-400" />
                  </div>
                )}
              </div>
            ))}

            {/* Custom Board anlegen */}
            <button className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-slate-600 transition-colors hover:border-forge-700 hover:text-forge-500">
              <PlusCircle className="h-4 w-4" />
              <span className="text-xs">Custom Board hinzufügen</span>
            </button>
          </div>
        </>
      )}

      {/* ── Projekt erstellen (Sticky-Footer im Create-Modus) ── */}
      {isCreateMode && selectedBoardSummary && (
        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border bg-surface-raised/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="text-sm">
              <span className="text-slate-400">Board: </span>
              <span className="font-medium text-forge-300">{selectedBoardSummary.name}</span>
              {projectName.trim() && (
                <>
                  <span className="mx-2 text-slate-600">|</span>
                  <span className="text-slate-400">Projekt: </span>
                  <span className="font-medium text-white">{projectName.trim()}</span>
                </>
              )}
            </div>
            <button
              onClick={handleCreateProject}
              disabled={createMutation.isPending || !projectName.trim()}
              className="flex items-center gap-2 rounded-lg bg-forge-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-forge-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Projekt erstellen
            </button>
          </div>
          {createMutation.isError && (
            <p className="mt-2 text-xs text-red-400">
              Fehler: {(createMutation.error as Error).message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
