import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusCircle, Loader2, AlertTriangle, FolderOpen } from 'lucide-react'
import { projectsApi } from '@/api/projects'
import { boardsApi } from '@/api/boards'
import { useProjectStore } from '@/store/useProjectStore'
import { ProjectCard } from './ProjectCard'

export function ProjectManager() {
  const queryClient = useQueryClient()
  const { startCreateProject } = useProjectStore()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Geräteliste laden ──
  const { data: devices, isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn:  () => projectsApi.devices(),
  })

  // ── Projekt löschen ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeletingId(null)
    },
  })

  // ── Forge-Projekt öffnen ──
  const handleOpenProject = async (deviceId: string) => {
    try {
      const project = await projectsApi.get(deviceId)
      const board = await boardsApi.get(project.board_id)
      const summary = (await boardsApi.list()).find((b) => b.id === project.board_id)
      if (summary) {
        useProjectStore.getState().openProject(project, summary, board)
      }
    } catch (err) {
      console.error('Fehler beim Öffnen des Projekts:', err)
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Projekt wirklich löschen? Die YAML-Datei wird ebenfalls entfernt.')) {
      setDeletingId(id)
      deleteMutation.mutate(id)
    }
  }

  const forgeDevices = devices?.filter((d) => d.created_by_forge) ?? []
  const externalDevices = devices?.filter((d) => !d.created_by_forge) ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Projekte</h1>
          <p className="mt-1 text-sm text-slate-400">
            Verwalte deine ESPHome-Geräte. Erstelle ein neues Projekt oder öffne ein bestehendes.
          </p>
        </div>
        <button
          onClick={() => startCreateProject()}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forge-500"
        >
          <PlusCircle className="h-4 w-4" />
          Neues Projekt
        </button>
      </div>

      {/* ── Loading / Error ── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Geräte laden…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Fehler beim Laden: {(error as Error).message}
        </div>
      ) : (
        <>
          {/* ── Forge-Projekte ── */}
          {forgeDevices.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <FolderOpen className="h-4 w-4 text-forge-400" />
                Forge-Projekte
                <span className="text-xs font-normal text-slate-500">({forgeDevices.length})</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {forgeDevices.map((d) => (
                  <div key={d.id} className="relative">
                    <ProjectCard
                      device={d}
                      onClick={() => handleOpenProject(d.id)}
                      onDelete={() => handleDelete(d.id)}
                    />
                    {deletingId === d.id && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                        <Loader2 className="h-6 w-6 animate-spin text-red-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Leerer Zustand ── */}
          {forgeDevices.length === 0 && externalDevices.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forge-900/30">
                <PlusCircle className="h-8 w-8 text-forge-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-300">Noch keine Projekte</p>
                <p className="mt-1 text-sm text-slate-500">
                  Erstelle dein erstes ESPHome-Projekt mit Forge.
                </p>
              </div>
              <button
                onClick={() => startCreateProject()}
                className="rounded-lg bg-forge-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-forge-500"
              >
                Projekt erstellen
              </button>
            </div>
          )}

          {/* ── Externe ESPHome-Geräte ── */}
          {externalDevices.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <FolderOpen className="h-4 w-4 text-slate-600" />
                Externe ESPHome-Geräte
                <span className="text-xs font-normal text-slate-600">({externalDevices.length})</span>
              </h2>
              <p className="text-xs text-slate-600">
                Diese Geräte wurden außerhalb von Forge erstellt und können hier nicht bearbeitet werden.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {externalDevices.map((d) => (
                  <ProjectCard key={d.id} device={d} onClick={() => {}} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
