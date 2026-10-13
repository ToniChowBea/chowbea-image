import axios from "axios"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as JobsModule from "./jobs"
import type { JobAccepted, JobDownload } from "./jobs"
import {
  compressImages,
  convertImages,
  cropImages,
  fixFiles,
  formatBytes,
  resizeImages,
  rotateImages,
} from "./api"
import { runJobFlow } from "./jobs"

vi.mock("./jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof JobsModule>()
  return {
    ...actual,
    runJobFlow: vi.fn(
      async (opts: { submit: () => Promise<JobAccepted>; tool: string }) => {
        await opts.submit()
        return {
          blob: new Blob(["out"]),
          filename: "out.png",
          headers: {},
        } satisfies JobDownload
      }
    ),
  }
})

const runJobFlowMock = vi.mocked(runJobFlow)

function file(name = "a.png"): File {
  return new File(["x"], name, { type: "image/png" })
}

/** Submit `run`, capturing the URL + FormData handed to axios.post and the tool passed to runJobFlow. */
async function capture(run: () => Promise<unknown>) {
  const postSpy = vi.spyOn(axios, "post").mockResolvedValue({
    data: { job_id: "job1", position: null, queue_size: 0 },
  })
  runJobFlowMock.mockClear()
  await run()
  const [url, form] = postSpy.mock.calls[0] as [string, FormData]
  return { url, form, tool: runJobFlowMock.mock.calls[0][0].tool }
}

describe("formatBytes", () => {
  it("formats byte counts", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB")
    expect(formatBytes(500)).toBe("500 B")
  })
})

describe("convertImages", () => {
  afterEach(() => vi.restoreAllMocks())

  it("posts /img/convert with files, target, and quality", async () => {
    const files = [file("a.png"), file("b.png")]
    const { url, form, tool } = await capture(() =>
      convertImages(files, "webp", 80)
    )
    expect(url).toBe("http://localhost:8000/img/convert")
    expect(tool).toBe("convert")
    expect(form.getAll("files")).toEqual(files)
    expect(form.get("target")).toBe("webp")
    expect(form.get("quality")).toBe("80")
  })

  it("omits quality when null", async () => {
    const { form } = await capture(() => convertImages([file()], "png", null))
    expect(form.has("quality")).toBe(false)
  })
})

describe("compressImages", () => {
  afterEach(() => vi.restoreAllMocks())

  it("posts /img/compress with files and quality", async () => {
    const files = [file()]
    const { url, form, tool } = await capture(() => compressImages(files, 60))
    expect(url).toBe("http://localhost:8000/img/compress")
    expect(tool).toBe("compress")
    expect(form.getAll("files")).toEqual(files)
    expect(form.get("quality")).toBe("60")
  })
})

describe("resizeImages", () => {
  afterEach(() => vi.restoreAllMocks())

  it("percent mode sets mode=percent and percent", async () => {
    const { url, form, tool } = await capture(() =>
      resizeImages([file()], { mode: "percent", percent: 50 })
    )
    expect(url).toBe("http://localhost:8000/img/resize")
    expect(tool).toBe("resize")
    expect(form.get("mode")).toBe("percent")
    expect(form.get("percent")).toBe("50")
    expect(form.has("width")).toBe(false)
    expect(form.has("preset")).toBe(false)
  })

  it("dimensions mode sets width/height/lock_aspect", async () => {
    const { form } = await capture(() =>
      resizeImages([file()], {
        mode: "dimensions",
        width: 800,
        height: 600,
        lockAspect: false,
      })
    )
    expect(form.get("mode")).toBe("dimensions")
    expect(form.get("width")).toBe("800")
    expect(form.get("height")).toBe("600")
    expect(form.get("lock_aspect")).toBe("false")
    expect(form.has("percent")).toBe(false)
  })

  it("preset mode sets preset", async () => {
    const { form } = await capture(() =>
      resizeImages([file()], { mode: "preset", preset: "1920" })
    )
    expect(form.get("mode")).toBe("preset")
    expect(form.get("preset")).toBe("1920")
    expect(form.has("width")).toBe(false)
  })
})

describe("rotateImages", () => {
  afterEach(() => vi.restoreAllMocks())

  it("posts /img/rotate with rotation and flip", async () => {
    const { url, form, tool } = await capture(() =>
      rotateImages([file()], { rotation: 90, flip: "horizontal" })
    )
    expect(url).toBe("http://localhost:8000/img/rotate")
    expect(tool).toBe("rotate")
    expect(form.get("rotation")).toBe("90")
    expect(form.get("flip")).toBe("horizontal")
  })
})

describe("fixFiles", () => {
  afterEach(() => vi.restoreAllMocks())

  it("posts /img/fix with the preset and returns the job report", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      data: { job_id: "job1", position: null, queue_size: 0 },
    })
    vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (String(url).includes("/download")) {
        return {
          data: new Blob(["out"]),
          headers: { "content-disposition": 'attachment; filename="out.jpg"' },
        }
      }
      return {
        data: {
          id: "job1",
          tool: "fix",
          status: "done",
          position: null,
          queue_size: 0,
          error: null,
          file_count: 1,
          total_bytes: 10,
          created_at: 0,
          report: {
            preset_id: "jpg-1mb",
            preset_name: "JPG under 1 MB",
            passed: true,
            files: [],
          },
        },
      }
    })
    const result = await fixFiles([file("a.jpg")], "jpg-1mb")
    expect(vi.mocked(axios.post).mock.calls[0]?.[0]).toBe("http://localhost:8000/img/fix")
    const form = vi.mocked(axios.post).mock.calls[0]?.[1] as FormData
    expect(form.get("preset")).toBe("jpg-1mb")
    expect(form.get("merge")).toBe("false")
    expect(form.has("token")).toBe(false)
    expect(result.filename).toBe("out.jpg")
    expect(result.report.preset_id).toBe("jpg-1mb")
    expect(result.report.passed).toBe(true)
  })

  it("posts merge and token for an evidence pack", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      data: { job_id: "job1", position: null, queue_size: 0 },
    })
    vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (String(url).includes("/download")) {
        return {
          data: new Blob(["out"]),
          headers: { "content-disposition": 'attachment; filename="evidence-pack.pdf"' },
        }
      }
      return {
        data: {
          id: "job1",
          tool: "fix",
          status: "done",
          position: null,
          queue_size: 0,
          error: null,
          file_count: 2,
          total_bytes: 10,
          created_at: 0,
          report: {
            preset_id: "ucas-documents",
            preset_name: "UCAS documents",
            passed: true,
            files: [],
            merged: true,
          },
        },
      }
    })
    await fixFiles([file("a.pdf"), file("b.pdf")], "ucas-documents", undefined, {
      merge: true,
      token: "batch.jti.1.sig",
    })
    const form = vi.mocked(axios.post).mock.calls[0]?.[1] as FormData
    expect(form.get("merge")).toBe("true")
    expect(form.get("token")).toBe("batch.jti.1.sig")
  })
})

describe("cropImages", () => {
  afterEach(() => vi.restoreAllMocks())

  it("aspect mode sets mode and aspect", async () => {
    const { url, form, tool } = await capture(() =>
      cropImages([file()], { mode: "aspect", aspect: "16:9" })
    )
    expect(url).toBe("http://localhost:8000/img/crop")
    expect(tool).toBe("crop")
    expect(form.get("mode")).toBe("aspect")
    expect(form.get("aspect")).toBe("16:9")
    expect(form.has("rect")).toBe(false)
  })

  it("rect mode sets rect as JSON", async () => {
    const rect = { x: 1, y: 2, width: 3, height: 4 }
    const { form } = await capture(() =>
      cropImages([file()], { mode: "rect", rect })
    )
    expect(form.get("mode")).toBe("rect")
    expect(form.get("rect")).toBe(JSON.stringify(rect))
    expect(form.has("aspect")).toBe(false)
  })
})
