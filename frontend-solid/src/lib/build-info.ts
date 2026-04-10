export interface FrontendBuildInfo {
  version: string
  buildKind: "release" | "dev"
  gitTag: string | null
  commitSha: string | null
  dirty: boolean
}

declare const __MEDIAFLICK_BUILD_INFO__: FrontendBuildInfo

export const frontendBuildInfo = __MEDIAFLICK_BUILD_INFO__

export function formatBuildInfoTooltip(info: FrontendBuildInfo): string {
  const details = [
    info.version,
    info.buildKind === "release" ? "Release build" : "Development build",
  ]

  if (info.gitTag) {
    details.push(`tag ${info.gitTag}`)
  }
  if (info.commitSha) {
    details.push(`commit ${info.commitSha}`)
  }
  if (info.dirty) {
    details.push("local changes")
  }

  return details.join(" • ")
}
