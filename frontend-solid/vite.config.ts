import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

interface BuildInfo {
  version: string
  buildKind: "release" | "dev"
  gitTag: string | null
  commitSha: string | null
  dirty: boolean
}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

function readEnvBoolean(name: string): boolean | null {
  const value = readEnv(name)
  if (value === "1" || value?.toLowerCase() === "true") {
    return true
  }
  if (value === "0" || value?.toLowerCase() === "false") {
    return false
  }
  return null
}

function runGit(args: string[]): string | null {
  try {
    const output = execFileSync("git", args, {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return output.length > 0 ? output : null
  } catch {
    return null
  }
}

function readFallbackVersion(): string | null {
  try {
    const version = readFileSync(resolve(__dirname, "../VERSION"), "utf8").trim()
    return version.length > 0 ? version : null
  } catch {
    return null
  }
}

function resolveBuildInfo(): BuildInfo {
  const version = readEnv("MEDIAFLICK_VERSION")
  if (version) {
    return {
      version,
      buildKind: readEnv("MEDIAFLICK_BUILD_KIND") === "release" ? "release" : "dev",
      gitTag: readEnv("MEDIAFLICK_GIT_TAG"),
      commitSha: readEnv("MEDIAFLICK_COMMIT_SHA"),
      dirty: readEnvBoolean("MEDIAFLICK_GIT_DIRTY") ?? version.endsWith("-dirty"),
    }
  }

  const exactTag = runGit(["describe", "--tags", "--exact-match"])
  const latestTag = exactTag ?? runGit(["describe", "--tags", "--abbrev=0"])
  const commitSha = runGit(["rev-parse", "--short", "HEAD"])
  const dirty = Boolean(runGit(["status", "--porcelain"]))

  if (exactTag) {
    return {
      version: dirty && commitSha
        ? `${exactTag}-dev+${commitSha}-dirty`
        : dirty
          ? `${exactTag}-dirty`
          : exactTag,
      buildKind: dirty ? "dev" : "release",
      gitTag: exactTag,
      commitSha,
      dirty,
    }
  }

  if (latestTag && commitSha) {
    return {
      version: `${latestTag}-dev+${commitSha}${dirty ? "-dirty" : ""}`,
      buildKind: "dev",
      gitTag: latestTag,
      commitSha,
      dirty,
    }
  }

  if (commitSha) {
    return {
      version: `dev+${commitSha}${dirty ? "-dirty" : ""}`,
      buildKind: "dev",
      gitTag: null,
      commitSha,
      dirty,
    }
  }

  const fallbackVersion = readFallbackVersion()
  return {
    version: fallbackVersion ? `${fallbackVersion}-local` : dirty ? "dev-dirty" : "unknown",
    buildKind: "dev",
    gitTag: latestTag,
    commitSha,
    dirty,
  }
}

const buildInfo = resolveBuildInfo()

export default defineConfig({
  clearScreen: false,
  define: {
    __MEDIAFLICK_BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [tailwindcss(), solid()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
})
