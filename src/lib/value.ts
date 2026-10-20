import type { Node } from "@/lib/api"
import { cycleDays, daysUntil } from "@/lib/format"
import { convert, type Table } from "@/lib/fx"

/**
 * What the fleet is still worth. A subscription's remaining value is the part
 * of the period already paid for but not yet used; a one-off purchase keeps its
 * whole price until it expires, because nothing will renew it. Expired nodes are
 * worth nothing, and nodes without a price are counted but not valued.
 */

export type Value = {
  /** In the display currency, over the nodes that could be converted. */
  total: number
  priced: number
  /** Priced, but in a currency no rate covers. */
  unpriced: number
  /** Priced and expired: worth zero, but worth saying so. */
  expired: number
  /** Days to the next expiry, null when nothing expires. */
  next: number | null
  soon: number
}

export function remainingValue(nodes: Node[], currency: string, table: Table | null): Value {
  let total = 0
  let priced = 0
  let unpriced = 0
  let expired = 0
  let next: number | null = null
  let soon = 0

  for (const node of nodes) {
    const left = node.expires_in !== undefined ? node.expires_in : daysUntil(node.expires_at)
    if (left !== null) {
      if (left < 0) expired++
      else {
        if (next === null || left < next) next = left
        if (left <= 7) soon++
      }
    }
    if (!(node.price > 0)) continue
    const days = cycleDays(node.billing_cycle || "monthly")
    // A one-off is not amortised: it was bought outright and runs out on its date.
    const share = days === null ? 1 : Math.max(0, Math.min(1, (left ?? days) / days))
    const worth = node.price * share
    const shown = convert(worth, node.currency || "CNY", currency, table)
    if (shown === null) unpriced++
    else if (shown > 0) {
      // An expired subscription converts to zero; counting it as "paying" would
      // put a ¥0.00 total next to "3 台在付费".
      total += shown
      priced++
    }
  }

  return { total, priced, unpriced, expired, next, soon }
}
