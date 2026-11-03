/// <reference lib="webworker" />
import { XyzParser } from './xyz'

/** Reads a File or a URL as a text stream and parses it off the main thread. */
self.onmessage = async (e: MessageEvent<{ file?: Blob; url?: string }>) => {
  try {
    let blob = e.data.file
    if (!blob && e.data.url) {
      const res = await fetch(e.data.url)
      if (!res.ok) throw new Error(`could not load the sample (${res.status})`)
      blob = await res.blob()
    }
    if (!blob) throw new Error('nothing to read')
    const parser = new XyzParser()
    const reader = blob.stream().getReader()
    const decoder = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    const cloud = parser.finish()
    if (!cloud) {
      self.postMessage({ empty: true, skipped: parser.skipped })
      return
    }
    self.postMessage({ cloud }, [cloud.positions.buffer])
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
