import manifest from "../../theme.json"

export type Field = {
  key: string
  type: "string" | "text" | "number" | "boolean" | "select"
  default: unknown
  label?: string
  help?: string
  options?: { value: string; label?: string }[]
  min?: number
  max?: number
}

export type Entry = Field | { type: "title"; label: string }

// The same value check the panel applies. A saved value may come from an older
// version of this theme, and one that no longer fits counts as never saved.
function fits(field: Field, value: unknown): boolean {
  switch (field.type) {
    case "boolean":
      return typeof value === "boolean"
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        && value >= (field.min ?? -Infinity) && value <= (field.max ?? Infinity)
    case "select":
      return !!field.options?.some((option) => option.value === value)
    default:
      return typeof value === "string"
  }
}

/** Group headings (type `title`) store nothing. */
export const entries = (manifest.config ?? []) as Entry[]
export const fields = entries.filter((f): f is Field => f.type !== "title")

export type Values = Record<string, unknown>

const url = `/api/themes/${manifest.short}/config`

export async function loadConfig(): Promise<Values> {
  let saved: Values = {}
  try {
    const res = await fetch(url)
    if (res.ok) saved = await res.json()
  } catch {
    // Offline reads as defaults, and nothing is shown about it.
  }
  const pick = (f: Field) => (fits(f, saved[f.key]) ? saved[f.key] : f.default)
  return Object.fromEntries(fields.map((f) => [f.key, pick(f)]))
}

export async function saveConfig(values: Values): Promise<void> {
  // Read the raw object, not loadConfig()'s merged result.
  const read = await fetch(url)
  if (!read.ok) throw new Error(await read.text())
  const next: Values = await read.json()
  // Only declared keys change; the rest are left alone, and a value equal to
  // the default is dropped so a later default change reaches this site.
  for (const f of fields) {
    if (values[f.key] === f.default) delete next[f.key]
    else next[f.key] = values[f.key]
  }
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  })
  if (!res.ok) throw new Error(await res.text())
}

// ---- typed readers -------------------------------------------------------

export const text = (v: Values, key: string, fallback = "") =>
  typeof v[key] === "string" ? (v[key] as string) : fallback
export const flag = (v: Values, key: string, fallback = true) =>
  typeof v[key] === "boolean" ? (v[key] as boolean) : fallback
export const num = (v: Values, key: string, fallback = 0) =>
  typeof v[key] === "number" ? (v[key] as number) : fallback
