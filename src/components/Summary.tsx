import { useMemo } from "react"

import type { Node } from "@/lib/api"
import { bytes, money, percent, rate } from "@/lib/format"
import { rateNote, type Table } from "@/lib/fx"
import { remainingValue } from "@/lib/value"
import { Sparkline } from "@/components/Chart"
import { IconActivity, IconArrows, IconClock, IconGauge, IconServer, IconTag, IconWallet } from "@/components/icons"

/**
 * The eight tiles above the list. They describe whatever the page is currently
 * showing -- the whole fleet, or the group whose tab is selected -- because a
 * visitor who narrowed the list expects the numbers to narrow with it.
 */

const busy = (nodes: Node[]) =>
  nodes.reduce<Node | null>((worst, n) => {
    if (!n.online || !n.metrics) return worst
    return !worst || n.metrics.cpu > (worst.metrics?.cpu ?? 0) ? n : worst
  }, null)

/** This period's usage as the plan meters it: some plans count only one direction. */
export function monthUsage(node: Node): number {
  if (typeof node.month_used === "number") return node.month_used
  const rx = node.month_rx ?? 0
  const tx = node.month_tx ?? 0
  return node.traffic_mode === "up" ? tx : node.traffic_mode === "down" ? rx : rx + tx
}

export type SummaryProps = {
  nodes: Node[]
  /** What the tiles are counting: the whole fleet, a group, or a search result. */
  scope: string
  speed: { rx: number; tx: number }[]
  /** The currency the remaining value is shown in, from the theme settings. */
  currency: string
  /** Exchange rates, or null when the lookup failed and no manual table was given. */
  fx: Table | null
}

export function Summary({ nodes, scope, speed, currency, fx }: SummaryProps) {
  const stats = useMemo(() => {
    let online = 0
    let rx = 0
    let tx = 0
    let dayRx = 0
    let dayTx = 0
    let memUsed = 0
    let memTotal = 0
    let cpuSum = 0
    let cpuCount = 0
    let month = 0
    let quota = 0
    for (const n of nodes) {
      if (n.online) online++
      if (n.online && n.metrics) {
        rx += n.metrics.net_rx
        tx += n.metrics.net_tx
        cpuSum += n.metrics.cpu
        cpuCount++
        memUsed += n.metrics.mem_used
        memTotal += n.metrics.mem_total
      }
      dayRx += n.day_rx ?? 0
      dayTx += n.day_tx ?? 0
      month += monthUsage(n)
      if (n.traffic_limit > 0) quota += n.traffic_limit
    }
    return {
      online,
      rx,
      tx,
      dayRx,
      dayTx,
      memUsed,
      memTotal,
      cpu: cpuCount ? cpuSum / cpuCount : null,
      month,
      quota,
      worst: busy(nodes),
    }
  }, [nodes])

  const value = useMemo(() => remainingValue(nodes, currency, fx), [nodes, currency, fx])

  const rxSeries = speed.map((s) => s.rx)
  const txSeries = speed.map((s) => s.tx)
  // A site with no nodes, or none online yet, has no peak to report: the tile
  // says so rather than printing a rounded-up zero.
  const peak = Math.max(stats.rx, stats.tx, ...rxSeries, ...txSeries)
  const memPct = stats.memTotal > 0 ? percent(stats.memUsed, stats.memTotal) : 0
  const quotaPct = stats.quota > 0 ? percent(stats.month, stats.quota) : 0

  return (
    <div className="summary">
      <div className="tile">
        <div className="tile-label">
          <IconServer />
          在线节点
        </div>
        <div className="tile-value">
          {stats.online}
          <small> / {nodes.length}</small>
        </div>
        <div className="tile-foot">
          {!nodes.length
            ? "还没有节点"
            : `${scope}${nodes.length - stats.online > 0 ? ` · ${nodes.length - stats.online} 台离线` : " · 全部在线"}`}
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconActivity />
          负载最高
        </div>
        <div className="tile-value">
          {stats.worst?.metrics ? `${Math.round(stats.worst.metrics.cpu)}%` : "—"}
        </div>
        <div className="tile-foot">
          {stats.worst
            ? `${stats.worst.name}${stats.worst.metrics ? ` · ${stats.worst.metrics.load[0].toFixed(2)} 负载` : ""}`
            : "没有在线节点"}
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconArrows />
          实时网速
        </div>
        <div className="tile-value flow">
          <span title="下行">
            ↓ {rate(stats.rx)}
            <em>下行</em>
          </span>
          <span title="上行">
            ↑ {rate(stats.tx)}
            <em>上行</em>
          </span>
        </div>
        <div className="tile-spark">
          <Sparkline points={rxSeries} color="var(--accent)" height={26} />
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconArrows />
          今日流量
        </div>
        <div className="tile-value flow">
          <span title="下行">
            ↓ {bytes(stats.dayRx)}
            <em>下行</em>
          </span>
          <span title="上行">
            ↑ {bytes(stats.dayTx)}
            <em>上行</em>
          </span>
        </div>
        <div className="tile-foot">
          {peak > 0
            ? `今日峰值 ${rate(peak)}`
            : stats.dayRx + stats.dayTx > 0
              ? "节点离线，没有实时峰值"
              : "还没有流量记录"}
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconWallet />
          剩余价值
        </div>
        <div className="tile-value">{value.priced > 0 ? money(value.total, currency) : "—"}</div>
        <div className="tile-foot">
          {value.priced > 0
            ? `${value.priced} 台在付费${value.unpriced > 0 ? ` · ${value.unpriced} 台缺汇率` : ""}`
            : value.unpriced > 0
              ? "缺少汇率，无法换算"
              : value.expired > 0
                ? "有价格的节点都已过期"
                : "节点都没有填价格"}
        </div>
        <div className="tile-note">{rateNote(fx, currency)}</div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconGauge />
          本月流量
        </div>
        <div className="tile-value">
          {stats.quota > 0 ? (
            <>
              {Math.round(quotaPct)}
              <small>%</small>
            </>
          ) : (
            bytes(stats.month)
          )}
        </div>
        {stats.quota > 0 ? (
          <div className="meter-bar tile-bar">
            <i
              className={quotaPct >= 90 ? "danger" : quotaPct >= 75 ? "warn" : ""}
              style={{ width: `${Math.min(100, quotaPct)}%` }}
            />
          </div>
        ) : null}
        <div className="tile-foot">
          {stats.quota > 0 ? `${bytes(stats.month)} / ${bytes(stats.quota)}` : "节点都没有设流量上限"}
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconTag />
          内存占用
        </div>
        <div className="tile-value">
          {stats.memTotal > 0 ? (
            <>
              {Math.round(memPct)}
              <small>%</small>
            </>
          ) : (
            "—"
          )}
        </div>
        {stats.memTotal > 0 ? (
          <div className="meter-bar tile-bar">
            <i className={memPct >= 90 ? "danger" : memPct >= 75 ? "warn" : ""} style={{ width: `${Math.min(100, memPct)}%` }} />
          </div>
        ) : null}
        <div className="tile-foot">
          {stats.memTotal > 0 ? `${bytes(stats.memUsed)} / ${bytes(stats.memTotal)}` : "没有在线节点"}
        </div>
        {stats.cpu !== null ? <div className="tile-note">CPU 平均 {Math.round(stats.cpu)}%</div> : null}
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconClock />
          到期提醒
        </div>
        <div className="tile-value">
          {value.soon > 0 ? (
            <>
              {value.soon}
              <small> 台</small>
            </>
          ) : value.next !== null ? (
            <>
              {value.next}
              <small> 天</small>
            </>
          ) : value.expired > 0 ? (
            <>
              {value.expired}
              <small> 台</small>
            </>
          ) : (
            "—"
          )}
        </div>
        <div className="tile-foot">
          {value.expired > 0
            ? `${value.expired} 台已过期${value.soon > 0 ? ` · ${value.soon} 台一周内到期` : ""}`
            : value.soon > 0
              ? "一周内到期"
              : value.next !== null
                ? `最近一台 ${value.next} 天后到期`
                : "都没有到期日"}
        </div>
      </div>
    </div>
  )
}

/** A bar with its own colour band, used by both the card and the detail page. */
export function Meter({ label, value, used, total, hint }: { label: string; value: number; used: string; total?: string; hint?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const level = pct >= 90 ? "danger" : pct >= 75 ? "warn" : ""
  return (
    <div className="meter">
      <div className="meter-top">
        <span>{label}</span>
        <b>{Math.round(value)}%</b>
      </div>
      <div className="meter-bar">
        <i className={level} style={{ width: `${pct}%` }} />
      </div>
      <div className="meter-foot">{hint ?? (total ? `${used} / ${total}` : used)}</div>
    </div>
  )
}
