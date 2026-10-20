import type { Node } from "@/lib/api"

/**
 * What the page is showing. A group is operator-written text and could be
 * called "全部节点" or "离线" as easily as anything else, so the two virtual
 * scopes are their own cases instead of magic strings sharing that space.
 */
export type Scope =
  | { kind: "all" }
  | { kind: "online" }
  | { kind: "offline" }
  | { kind: "group"; name: string }

export const ALL: Scope = { kind: "all" }
export const ONLINE: Scope = { kind: "online" }
export const OFFLINE: Scope = { kind: "offline" }

export function inScope(node: Node, scope: Scope): boolean {
  switch (scope.kind) {
    case "all":
      return true
    case "online":
      return node.online
    case "offline":
      return !node.online
    case "group":
      return (node.group ?? "") === scope.name
  }
}

export function scopeLabel(scope: Scope): string {
  switch (scope.kind) {
    case "all":
      return "全部节点"
    case "online":
      return "全部在线"
    case "offline":
      return "离线"
    case "group":
      return scope.name
  }
}

export function sameScope(a: Scope, b: Scope): boolean {
  if (a.kind !== b.kind) return false
  return a.kind !== "group" || b.kind !== "group" || a.name === b.name
}
