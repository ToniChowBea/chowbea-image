import { create } from "zustand"
import { extOf, isBrowserRenderable, objectUrlFor, revokeUrl } from "../lib/images"
import type { JobProgress } from "../lib/jobs"

export type ToolName = "convert" | "compress" | "resize" | "rotate" | "crop"

export interface WorkspaceImage {
  id: string
  file: File
  name: string
  size: number
  ext: string
  previewable: boolean
  url: string | null
}

export interface ConvertOptions {
  target: string
  quality: number
}

export interface CompressOptions {
  quality: number
}

export interface ResizeOptions {
  mode: string
  width: number | null
  height: number | null
  lockAspect: boolean
  percent: number
  preset: string
}

export interface RotateOptions {
  rotation: number
  flip: string
}

export interface CropOptions {
  mode: string
  aspect: string
  rect: null
}

export interface WorkspaceState {
  images: WorkspaceImage[]
  selectedIds: Set<string>
  activeTool: ToolName | null
  options: {
    convert: ConvertOptions
    compress: CompressOptions
    resize: ResizeOptions
    rotate: RotateOptions
    crop: CropOptions
  }
  progress: JobProgress | null
  result: { blob: Blob; filename: string } | null
  error: string | null

  // Actions
  addFiles(files: File[]): void
  removeImage(id: string): void
  clear(): void
  toggleSelect(id: string): void
  selectAll(): void
  selectNone(): void
  setActiveTool(tool: ToolName | null): void
  setOption<T extends ToolName>(tool: T, patch: Partial<WorkspaceState["options"][T]>): void
  setProgress(progress: JobProgress | null): void
  setResult(result: { blob: Blob; filename: string } | null): void
  setError(error: string | null): void
  reset(): void
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  // Initial state
  images: [],
  selectedIds: new Set(),
  activeTool: null,
  options: {
    convert: { target: "png", quality: 80 },
    compress: { quality: 70 },
    resize: {
      mode: "percent",
      width: null,
      height: null,
      lockAspect: true,
      percent: 100,
      preset: "1920",
    },
    rotate: { rotation: 0, flip: "none" },
    crop: { mode: "aspect", aspect: "1:1", rect: null },
  },
  progress: null,
  result: null,
  error: null,

  // Actions
  addFiles(files: File[]) {
    set((state) => {
      const newImages: WorkspaceImage[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        ext: extOf(file.name),
        previewable: isBrowserRenderable(file.name),
        url: isBrowserRenderable(file.name) ? objectUrlFor(file) : null,
      }))

      const allImages = [...state.images, ...newImages]
      const newSelectedIds = new Set(state.selectedIds)
      newImages.forEach((img) => {
        newSelectedIds.add(img.id)
      })

      return {
        images: allImages,
        selectedIds: newSelectedIds,
      }
    })
  },

  removeImage(id: string) {
    set((state) => {
      const image = state.images.find((img) => img.id === id)
      if (image && image.url) {
        revokeUrl(image.url)
      }

      const newImages = state.images.filter((img) => img.id !== id)
      const newSelectedIds = new Set(state.selectedIds)
      newSelectedIds.delete(id)

      return {
        images: newImages,
        selectedIds: newSelectedIds,
      }
    })
  },

  clear() {
    set((state) => {
      state.images.forEach((image) => {
        if (image.url) {
          revokeUrl(image.url)
        }
      })

      return {
        images: [],
        selectedIds: new Set(),
      }
    })
  },

  toggleSelect(id: string) {
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds)
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id)
      } else {
        newSelectedIds.add(id)
      }
      return { selectedIds: newSelectedIds }
    })
  },

  selectAll() {
    set((state) => {
      const newSelectedIds = new Set<string>()
      state.images.forEach((img) => {
        newSelectedIds.add(img.id)
      })
      return { selectedIds: newSelectedIds }
    })
  },

  selectNone() {
    set(() => ({ selectedIds: new Set() }))
  },

  setActiveTool(tool: ToolName | null) {
    set(() => ({ activeTool: tool }))
  },

  setOption(tool: ToolName, patch: any) {
    set((state) => ({
      options: {
        ...state.options,
        [tool]: {
          ...state.options[tool],
          ...patch,
        },
      },
    }))
  },

  setProgress(progress: JobProgress | null) {
    set(() => ({ progress }))
  },

  setResult(result: { blob: Blob; filename: string } | null) {
    set(() => ({ result }))
  },

  setError(error: string | null) {
    set(() => ({ error }))
  },

  reset() {
    set(() => ({
      progress: null,
      result: null,
      error: null,
    }))
  },
}))
