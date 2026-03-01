import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BoardSummary, Board } from '@/types/board'

// ── Wizard-Steps ──────────────────────────────────────────────────────────
export type WizardStep =
  | 'board-select'    // 1. Board auswählen
  | 'board-detail'    // 2. Board-Info + GPIO-Übersicht
  | 'add-component'   // 3. Neue physische Komponente hinzufügen
  | 'automation'      // 4. Automation / Flow-Editor

export interface AddedComponent {
  uid:      string   // Lokale UUID
  compType: string   // ESPHome-Platform (z.B. "dht", "bme280")
  name:     string   // Benutzerfreundlicher Name
  pins:     Record<string, number>  // role → GPIO-Nummer
  ha_visible: boolean
  config:   Record<string, unknown>
}

// ── Store-State ───────────────────────────────────────────────────────────
interface ProjectState {
  // Wizard-Navigation
  step: WizardStep
  setStep: (s: WizardStep) => void

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
      step: 'board-select',
      setStep: (step) => set({ step }),

      // ── Board
      selectedBoardSummary: null,
      selectedBoard: null,
      setSelectedBoard: (summary, full) =>
        set({ selectedBoardSummary: summary, selectedBoard: full ?? null, step: 'board-detail' }),
      setFullBoard: (b) => set({ selectedBoard: b }),
      clearBoard: () =>
        set({ selectedBoardSummary: null, selectedBoard: null, components: [], step: 'board-select' }),

      // ── Komponenten
      components: [],
      addComponent: (c) =>
        set((s) => ({ components: [...s.components, c] })),
      removeComponent: (uid) =>
        set((s) => ({ components: s.components.filter((c) => c.uid !== uid) })),
      updateComponent: (uid, patch) =>
        set((s) => ({
          components: s.components.map((c) => (c.uid === uid ? { ...c, ...patch } : c)),
        })),

      // ── Filter
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      filterFamily: null,
      setFilterFamily: (filterFamily) => set({ filterFamily }),
    }),
    {
      name: 'esphome-forge-project',
      // Nur die persistenten Felder speichern
      partialize: (s) => ({
        selectedBoardSummary: s.selectedBoardSummary,
        components: s.components,
        step: s.step,
      }),
    }
  )
)
