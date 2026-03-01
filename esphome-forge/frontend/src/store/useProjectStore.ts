import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BoardSummary, Board } from '@/types/board'
import type { ForgeProject, ProjectComponent } from '@/types/project'
import { projectsApi } from '@/api/projects'

// ── Wizard-Steps ──────────────────────────────────────────────────────────
export type WizardStep =
  | 'project-list'    // 0. Projekte verwalten (Startseite)
  | 'board-select'    // 1. Board auswählen (neues Projekt)
  | 'board-detail'    // 2. Projektansicht: Board + Komponenten + GPIOs
  | 'automation'      // 3. Automation / Flow-Editor

export interface AddedComponent {
  uid:      string   // Lokale UUID
  compType: string   // ESPHome-Platform (z.B. "dht", "bme280")
  name:     string   // Benutzerfreundlicher Name
  pins:     Record<string, number>  // role → GPIO-Nummer
  ha_visible: boolean
  config:   Record<string, unknown>
}

/** Konvertiert AddedComponent → ProjectComponent für die Backend-API */
function toProjectComponent(c: AddedComponent): ProjectComponent {
  return {
    uid: c.uid,
    comp_type: c.compType,
    name: c.name,
    pins: c.pins,
    ha_visible: c.ha_visible,
    config: c.config,
  }
}

/** Synct Komponenten zum Backend (fire-and-forget) */
function syncToBackend(projectId: string | undefined, components: AddedComponent[]) {
  if (!projectId) return
  projectsApi.updateComponents(projectId, components.map(toProjectComponent)).catch((err) => {
    console.warn('[Forge] Sync fehlgeschlagen:', err)
  })
}

// ── Store-State ───────────────────────────────────────────────────────────
interface ProjectState {
  // Wizard-Navigation
  step: WizardStep
  setStep: (s: WizardStep) => void

  // Aktives Projekt
  activeProject: ForgeProject | null
  openProject: (project: ForgeProject, boardSummary: BoardSummary, board: Board) => void
  clearProject: () => void

  // Neues Projekt erstellen (Flow)
  pendingProjectName: string | null
  startCreateProject: () => void
  setPendingProjectName: (name: string | null) => void
  confirmProjectCreated: (project: ForgeProject, boardSummary: BoardSummary, board: Board) => void

  // Ausgewähltes Board
  selectedBoardSummary: BoardSummary | null
  selectedBoard: Board | null
  setSelectedBoard: (summary: BoardSummary, full?: Board) => void
  setFullBoard: (b: Board) => void
  clearBoard: () => void

  // Hinzugefügte Komponenten
  components: AddedComponent[]
  addComponent: (c: AddedComponent) => void
  removeComponent: (uid: string) => void
  updateComponent: (uid: string, patch: Partial<AddedComponent>) => void

  // Board-Picker Filter
  searchQuery: string
  setSearchQuery: (q: string) => void
  filterFamily: string | null
  setFilterFamily: (f: string | null) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      // ── Navigation
      step: 'project-list',
      setStep: (step) => set({ step }),

      // ── Aktives Projekt
      activeProject: null,
      openProject: (project, boardSummary, board) =>
        set({
          activeProject: project,
          selectedBoardSummary: boardSummary,
          selectedBoard: board,
          pendingProjectName: null,
          // Lade Komponenten aus dem Backend-Projekt
          components: (project.components ?? []).map((pc) => ({
            uid: pc.uid,
            compType: pc.comp_type,
            name: pc.name,
            pins: pc.pins,
            ha_visible: pc.ha_visible,
            config: pc.config,
          })),
          step: 'board-detail',
        }),
      clearProject: () =>
        set({
          activeProject: null,
          selectedBoardSummary: null,
          selectedBoard: null,
          components: [],
          pendingProjectName: null,
          step: 'project-list',
        }),

      // ── Neues Projekt (Create-Flow)
      pendingProjectName: null,
      startCreateProject: () =>
        set({ pendingProjectName: '', step: 'board-select' }),
      setPendingProjectName: (pendingProjectName) =>
        set({ pendingProjectName }),
      confirmProjectCreated: (project, boardSummary, board) =>
        set({
          activeProject: project,
          selectedBoardSummary: boardSummary,
          selectedBoard: board,
          pendingProjectName: null,
          step: 'board-detail',
        }),

      // ── Board
      selectedBoardSummary: null,
      selectedBoard: null,
      setSelectedBoard: (summary, full) =>
        set({ selectedBoardSummary: summary, selectedBoard: full ?? null }),
      setFullBoard: (b) => set({ selectedBoard: b }),
      clearBoard: () =>
        set({
          selectedBoardSummary: null,
          selectedBoard: null,
          components: [],
          pendingProjectName: null,
          step: 'project-list',
          activeProject: null,
        }),

      // ── Komponenten
      components: [],
      addComponent: (c) =>
        set((s) => {
          const next = [...s.components, c]
          syncToBackend(s.activeProject?.id, next)
          return { components: next }
        }),
      removeComponent: (uid) =>
        set((s) => {
          const next = s.components.filter((c) => c.uid !== uid)
          syncToBackend(s.activeProject?.id, next)
          return { components: next }
        }),
      updateComponent: (uid, patch) =>
        set((s) => {
          const next = s.components.map((c) => (c.uid === uid ? { ...c, ...patch } : c))
          syncToBackend(s.activeProject?.id, next)
          return { components: next }
        }),

      // ── Filter
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      filterFamily: null,
      setFilterFamily: (filterFamily) => set({ filterFamily }),
    }),
    {
      name: 'esphome-forge-project',
      partialize: (s) => ({
        activeProject: s.activeProject,
        selectedBoardSummary: s.selectedBoardSummary,
        components: s.components,
        step: s.step,
      }),
    }
  )
)

