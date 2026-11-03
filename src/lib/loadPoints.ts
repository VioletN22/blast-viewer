import { MAX_FILE_BYTES, type PointCloud } from './xyz'

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024))

/** The message for a file over the size limit, or null when it fits. */
export function sizeProblem(bytes: number): string | null {
  return bytes > MAX_FILE_BYTES ? `That file is ${mb(bytes)} MB. The limit is ${mb(MAX_FILE_BYTES)} MB.` : null
}

/** Parses a points file (or the sample at a URL) in a worker. Rejects with a message to show. */
export function loadPoints(source: { file: File } | { url: string }): Promise<PointCloud> {
  if ('file' in source) {
    const p = sizeProblem(source.file.size)
    if (p) return Promise.reject(new Error(p))
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./xyzWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ cloud?: PointCloud; empty?: boolean; skipped?: number; error?: string }>) => {
      worker.terminate()
      const d = e.data
      if (d.cloud) resolve(d.cloud)
      else if (d.empty) reject(new Error('No points found. Each line needs x, y and z.'))
      else reject(new Error(d.error ? `Could not read the file: ${d.error}` : 'Could not read the file.'))
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error('Could not read the file.'))
    }
    worker.postMessage('file' in source ? { file: source.file } : { url: source.url })
  })
}
