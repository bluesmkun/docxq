import { useEffect, useState } from "react"

/**
 * Exchange rates for the "remaining value" tile. A status page is static, so the
 * rates come from a public endpoint the browser can read directly, cached for
 * half a day; when that is unreachable the operator's manual rates in the theme
 * settings take over, and when neither exists the tile counts only the nodes
 * already priced in the display currency.
 */

export type Table = {
  /** Rates are quoted against this currency: `rates[X]` is how many X one unit buys. */
  base: string
  rates: Record<string, number>
  at: number
  source: "auto" | "manual"
}

const CACHE = "doc-fx-rates"
const TTL = 12 * 3600_000
const ENDPOINT = "https://open.er-api.com/v6/latest/CNY"

function usable(value: unknown): value is Table {
  if (!value || typeof value !== "object") return false
  const t = value as Table
  return typeof t.base === "string" && typeof t.at === "number" && !!t.rates && typeof t.rates === "object"
}

function readCache(): Table | null {
  try {
    const raw = localStorage.getItem(CACHE)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return usable(parsed) ? parsed : null
  } catch {
    // Storage can be switched off for the site, and then even reading throws.
    return null
  }
}

function writeCache(table: Table) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(table))
  } catch {
    // The rate then lasts until the page is closed.
  }
}

/**
 * "USD=7.2, HKD=0.92" -- how many yuan one unit of each currency is worth. The
 * manual table is quoted against CNY like the fetched one, so both convert the
 * same way.
 */
export function manualTable(spec: string): Table | null {
  const rates: Record<string, number> = { CNY: 1 }
  for (const part of spec.split(/[,;，；\s]+/)) {
    const match = /^([A-Za-z]{3})=([0-9.]+)$/.exec(part.trim())
    if (!match) continue
    const value = Number(match[2])
    if (Number.isFinite(value) && value > 0) rates[match[1].toUpperCase()] = 1 / value
  }
  return Object.keys(rates).length > 1 ? { base: "CNY", rates, at: 0, source: "manual" } : null
}

/** The manual table when the operator wrote one, else the fetched one, else the stale cache. */
export function useFx(manual: string): { table: Table | null; live: boolean } {
  const fixed = manualTable(manual)
  const [fetched, setFetched] = useState<Table | null>(() => readCache())

  useEffect(() => {
    if (fixed) return
    const cached = readCache()
    if (cached && cached.source === "auto" && Date.now() - cached.at < TTL) {
      setFetched(cached)
      return
    }
    // The rates are a nicety: a failure leaves the cached table, or nothing.
    const abort = new AbortController()
    fetch(ENDPOINT, { signal: abort.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: unknown) => {
        const data = body as { result?: string; base_code?: string; rates?: Record<string, number> }
        if (data?.result !== "success" || !data.rates) return
        const table: Table = { base: data.base_code ?? "CNY", rates: data.rates, at: Date.now(), source: "auto" }
        writeCache(table)
        setFetched(table)
      })
      .catch(() => {
        // Offline, blocked by a proxy, or the endpoint moved: keep what we had.
      })
    return () => abort.abort()
  }, [fixed])

  return { table: fixed ?? fetched, live: !fixed && !!fetched && Date.now() - fetched.at < TTL }
}

/** `amount` of `from` in `to`, or null when either currency is unknown. */
export function convert(amount: number, from: string, to: string, table: Table | null): number | null {
  const a = from.toUpperCase()
  const b = to.toUpperCase()
  if (a === b) return amount
  if (!table) return null
  const rate = (code: string) => (code === table.base ? 1 : table.rates[code])
  const fromRate = rate(a)
  const toRate = rate(b)
  if (!fromRate || !toRate) return null
  return (amount / fromRate) * toRate
}

/** "1 USD ≈ 7.19 CNY", for the tile's footnote. */
export function rateNote(table: Table | null, currency: string): string {
  if (currency === "CNY") return "人民币结算"
  if (!table) return "汇率不可用"
  const rate = table.base === currency ? 1 : table.rates[currency]
  if (!rate) return "汇率不可用"
  const cny = (1 / rate).toFixed(2)
  return `1 ${currency} ≈ ${cny} CNY`
}
