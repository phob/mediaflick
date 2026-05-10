import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export interface BuildInfo {
  version: string
  buildKind: "release" | "dev"
  gitTag: string | null
  commitSha: string | null
  dirty: boolean
}

const gitWorkdir = resolve(import.meta.dir, "../..")
const fallbackVersionPath = resolve(gitWorkdir, "../VERSION")

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
  let result: ReturnType<typeof Bun.spawnSync>
  try {
    result = Bun.spawnSync({
      cmd: ["git", ...args],
      cwd: gitWorkdir,
      stdout: "pipe",
      stderr: "pipe",
    })
  } catch {
    return null
  }

  if (result.exitCode !== 0) {
    return null
  }

  const output = new TextDecoder().decode(result.stdout).trim()
  return output.length > 0 ? output : null
}

function isBuildKind(value: unknown): value is BuildInfo["buildKind"] {
  return value === "release" || value === "dev"
}

function buildInfoFromJson(value: unknown): BuildInfo | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (typeof candidate.version !== "string" || !isBuildKind(candidate.buildKind)) {
    return null
  }

  return {
    version: candidate.version,
    buildKind: candidate.buildKind,
    gitTag: typeof candidate.gitTag === "string" ? candidate.gitTag : null,
    commitSha: typeof candidate.commitSha === "string" ? candidate.commitSha : null,
    dirty: typeof candidate.dirty === "boolean" ? candidate.dirty : false,
  }
}

function readBuildInfoFile(): BuildInfo | null {
  const path = readEnv("MEDIAFLICK_BUILD_INFO_PATH")
  if (!path || !existsSync(path)) {
    return null
  }

  try {
    return buildInfoFromJson(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return null
  }
}

function readFallbackVersion(): string | null {
  try {
    const version = readFileSync(fallbackVersionPath, "utf8").trim()
    return version.length > 0 ? version : null
  } catch {
    return null
  }
}

function resolveVersionFromGit(): BuildInfo {
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

export function resolveBuildInfo(): BuildInfo {
  const version = readEnv("MEDIAFLICK_VERSION")
  if (!version) {
    return readBuildInfoFile() ?? resolveVersionFromGit()
  }

  return {
    version,
    buildKind: readEnv("MEDIAFLICK_BUILD_KIND") === "release" ? "release" : "dev",
    gitTag: readEnv("MEDIAFLICK_GIT_TAG"),
    commitSha: readEnv("MEDIAFLICK_COMMIT_SHA"),
    dirty: readEnvBoolean("MEDIAFLICK_GIT_DIRTY") ?? version.endsWith("-dirty"),
  }
}

export const buildInfo = resolveBuildInfo()
