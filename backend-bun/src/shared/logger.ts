import { appendFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"

type LogLevel = "debug" | "info" | "warn" | "error"

export interface Logger {
  debug(message: string, props?: Record<string, unknown>): void
  info(message: string, props?: Record<string, unknown>): void
  warn(message: string, props?: Record<string, unknown>): void
  error(message: string, props?: Record<string, unknown>): void
}

function toLogLevel(level: LogLevel): string {
  if (level === "debug") return "Debug"
  if (level === "info") return "Information"
  if (level === "warn") return "Warning"
  return "Error"
}

export function createLogger(logDirectory: string): Logger {
  let initialized = false

  async function ensureDir() {
    if (initialized) return
    await mkdir(logDirectory, { recursive: true })
    initialized = true
  }

  function write(level: LogLevel, message: string, props?: Record<string, unknown>) {
    const timestamp = new Date().toISOString()
    const datePart = timestamp.slice(0, 10)
    const filePath = join(logDirectory, `log-${datePart}.json`)
    const payload = {
      Timestamp: timestamp,
      Level: toLogLevel(level),
      RenderedMessage: message,
      Properties: props ?? {},
    }

    if (level === "error") {
      console.error(message, props ?? {})
    } else if (level === "warn") {
      console.warn(message, props ?? {})
    } else {
      console.log(message, props ?? {})
    }

    const line = `${JSON.stringify(payload)}\n`
    void ensureDir().then(async () => {
      await mkdir(dirname(filePath), { recursive: true })
      await appendFile(filePath, line, "utf8")
    })
  }

  return {
    debug: (message, props) => write("debug", message, props),
    info: (message, props) => write("info", message, props),
    warn: (message, props) => write("warn", message, props),
    error: (message, props) => write("error", message, props),
  }
}
