/**
 * Client helpers for the Chowbea Image API.
 *
 * Every tool submits a job to the queue and receives the result through the
 * shared submit → poll → download flow in `lib/jobs.ts`. These wrappers keep
 * the per-tool signatures the pages consume.
 */

import axios from "axios"

import type { JobAccepted, JobProgress } from "./jobs"
import { API_BASE_URL, runJobFlow } from "./jobs"

/** Formats the convert tool can produce. */
export type ConvertTarget = "png" | "jpeg" | "webp" | "avif" | "tiff"

export type ResizeMode = "dimensions" | "percent" | "preset"
export type ResizePreset = "1920" | "1280" | "640"
export type FlipDirection = "none" | "horizontal" | "vertical"
export type CropMode = "aspect" | "rect"
export type AspectRatio = "1:1" | "4:3" | "16:9" | "9:16"

export interface ResizeOptions {
  mode: ResizeMode
  width?: number
  height?: number
  lockAspect?: boolean
  percent?: number
  preset?: ResizePreset
}

export interface RotateOptions {
  rotation: 0 | 90 | 180 | 270
  flip: FlipDirection
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CropOptions {
  mode: CropMode
  aspect?: AspectRatio
  rect?: CropRect
}

/** Result of a successful tool request. */
export interface ToolResult {
  /** The processed image (or a ZIP of several). */
  blob: Blob
  /** Suggested download filename parsed from the response. */
  filename: string
}

/** POST a multipart form and report upload progress until the job is accepted. */
async function submitForm(
  path: string,
  form: FormData,
  onProgress?: (progress: JobProgress) => void
): Promise<JobAccepted> {
  const response = await axios.post<JobAccepted>(
    `${API_BASE_URL}${path}`,
    form,
    {
      onUploadProgress: (event) => {
        if (!onProgress) return
        const percent = event.total ? (event.loaded / event.total) * 100 : null
        if (percent === null || percent < 100) {
          onProgress({ phase: "uploading", percent })
        }
      },
    }
  )
  return response.data
}

function appendFiles(form: FormData, files: File[]): void {
  for (const file of files) form.append("files", file)
}

function batchFilename(files: File[], prefix: string, zipName: string): string {
  return files.length === 1 ? `${prefix}${files[0].name}` : zipName
}

/**
 * Convert file(s) to the target format.
 *
 * @throws Error with the API's error detail on failure.
 */
export async function convertImages(
  files: File[],
  target: ConvertTarget,
  quality: number | null,
  onProgress?: (progress: JobProgress) => void
): Promise<ToolResult> {
  const form = new FormData()
  appendFiles(form, files)
  form.append("target", target)
  if (quality !== null) {
    form.append("quality", String(quality))
  }
  const download = await runJobFlow({
    tool: "convert",
    submit: () => submitForm("/img/convert", form, onProgress),
    onProgress,
  })
  return {
    blob: download.blob,
    filename:
      download.filename ??
      batchFilename(files, "converted-", "converted-images.zip"),
  }
}

/**
 * Compress one or more images at the given quality (1-100).
 *
 * @throws Error with the API's error detail on failure.
 */
export async function compressImages(
  files: File[],
  quality: number,
  onProgress?: (progress: JobProgress) => void
): Promise<ToolResult> {
  const form = new FormData()
  appendFiles(form, files)
  form.append("quality", String(quality))
  const download = await runJobFlow({
    tool: "compress",
    submit: () => submitForm("/img/compress", form, onProgress),
    onProgress,
  })
  return {
    blob: download.blob,
    filename:
      download.filename ?? batchFilename(files, "", "compressed-images.zip"),
  }
}

/**
 * Resize one or more images by exact dimensions, a percentage, or a named preset.
 *
 * @throws Error with the API's error detail on failure.
 */
export async function resizeImages(
  files: File[],
  opts: ResizeOptions,
  onProgress?: (progress: JobProgress) => void
): Promise<ToolResult> {
  const form = new FormData()
  appendFiles(form, files)
  form.append("mode", opts.mode)
  if (opts.mode === "dimensions") {
    if (opts.width !== undefined) form.append("width", String(opts.width))
    if (opts.height !== undefined) form.append("height", String(opts.height))
    if (opts.lockAspect !== undefined)
      form.append("lock_aspect", String(opts.lockAspect))
  } else if (opts.mode === "percent") {
    if (opts.percent !== undefined) form.append("percent", String(opts.percent))
  } else {
    if (opts.preset !== undefined) form.append("preset", opts.preset)
  }
  const download = await runJobFlow({
    tool: "resize",
    submit: () => submitForm("/img/resize", form, onProgress),
    onProgress,
  })
  return {
    blob: download.blob,
    filename:
      download.filename ??
      batchFilename(files, "resized-", "resized-images.zip"),
  }
}

/**
 * Rotate and/or flip one or more images.
 *
 * @throws Error with the API's error detail on failure.
 */
export async function rotateImages(
  files: File[],
  opts: RotateOptions,
  onProgress?: (progress: JobProgress) => void
): Promise<ToolResult> {
  const form = new FormData()
  appendFiles(form, files)
  form.append("rotation", String(opts.rotation))
  form.append("flip", opts.flip)
  const download = await runJobFlow({
    tool: "rotate",
    submit: () => submitForm("/img/rotate", form, onProgress),
    onProgress,
  })
  return {
    blob: download.blob,
    filename:
      download.filename ??
      batchFilename(files, "rotated-", "rotated-images.zip"),
  }
}

/**
 * Crop one or more images to a centred aspect ratio, or a single image to an
 * exact pixel rectangle.
 *
 * @throws Error with the API's error detail on failure.
 */
export async function cropImages(
  files: File[],
  opts: CropOptions,
  onProgress?: (progress: JobProgress) => void
): Promise<ToolResult> {
  const form = new FormData()
  appendFiles(form, files)
  form.append("mode", opts.mode)
  if (opts.mode === "aspect" && opts.aspect !== undefined) {
    form.append("aspect", opts.aspect)
  } else if (opts.mode === "rect" && opts.rect !== undefined) {
    form.append("rect", JSON.stringify(opts.rect))
  }
  const download = await runJobFlow({
    tool: "crop",
    submit: () => submitForm("/img/crop", form, onProgress),
    onProgress,
  })
  return {
    blob: download.blob,
    filename:
      download.filename ??
      batchFilename(files, "cropped-", "cropped-images.zip"),
  }
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Format a byte count as a human-readable string (e.g. "1.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}
