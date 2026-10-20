import { useEffect, useMemo, useState } from "react"

import { api, type Node } from "@/lib/api"
import {
  axisBytes,
  axisTop,
  bytes,
  clockFor,
  cycle,
  date,
  daysUntil,
  despike,
  flagOf,
  FOREVER,
  money,
  osName,
  pair,
  percent,
  quarters,
  rate,
  rateAxis,
  RATE_FLOOR,
  sinceSeen,
  smooth,
  span,
  tickClock,
  timeTicks,
  uptime,
  withGaps,
} from "@/lib/format"
import { Chart, type ChartSeries } from "@/components/Chart"
import { IconChevronLeft, IconFilter, IconSmooth } from "@/components/icons"

/* ------------------------------------------------------------------ 数据 */

type Row = {
  ts: number
  cpu: number
  cpu_max?: number
  mem_used: number
  swap_used: number
  disk_used: number
  net_rx: number
  net_tx: number
  net_rx_max?: number
  net_tx_max?: number
  tcp: number
  udp: number
  procs: number
  minutes: number
}

type PingRow = { task_id: string; ts: number; latency: number | null; band?: [number, number]; loss?: number }

/**
 * The history endpoint answers both series in one object, whichever ones were
 * asked for: the ones left out come back as empty arrays. `step` is the seconds
 * each point spans, sent rather than inferred so a window holding a single point
 * still has one.
 */
type History = {
  metrics: Row[]
  ping: PingRow[]
  probes: Record<string, string>
  loss: Record<string, number>
  step: number
}

/** A hub that answers with something else must not take the page down with it. */
const rowsOf = (data: History | null): History => ({
  metrics: Array.isArray(data?.metrics) ? data.metrics : [],
  ping: Array.isArray(data?.ping) ? data.ping : [],
  probes: data?.probes && typeof data.probes === "object" ? data.probes : {},
  loss: data?.loss && typeof data.loss === "object" ? data.loss : {},
  step: typeof data?.step === "number" && data.step > 0 ? data.step : 60,
})

/** A row's field as a finite number, or null: a gap row has no fields at all. */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** Used over total as a percentage, or null when either is missing. */
const share = (used: unknown, total: number): number | null => {
  const v = num(used)
  return v === null ? null : percent(v, total)
}

/** One attempt's worth of rows, discarded when the window or the tab changes under it. */
function useSeries<T>(id: number, hours: number, series: "metrics" | "ping", points: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // A result that lands after the window changed describes a chart nobody is
    // looking at any more, and would redraw the axes of the new one.
    let live = true
    setLoading(true)
    api<T>(`/nodes/${id}/metrics?hours=${hours}&points=${points}&series=${series}`)
      .then((next) => {
        if (!live) return
        setData(next)
        setError(null)
      })
      .catch((e: Error) => {
        if (!live) return
        setError(e.message)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [id, hours, series, points])

  return { data, error, loading }
}

/** Enough points for the pixels available, within what the hub accepts. */
function usePointCount() {
  const [points, setPoints] = useState(() => count())
  useEffect(() => {
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setPoints(count()))
    }
    addEventListener("resize", sync)
    return () => {
      removeEventListener("resize", sync)
      cancelAnimationFrame(frame)
    }
  }, [])
  return points
}

const count = () => Math.min(1440, Math.max(60, Math.round((innerWidth * (devicePixelRatio || 1)) / 2)))

/* ------------------------------------------------------------------ 页面 */

const PALETTE = ["var(--accent)", "#e08a3c", "#2f9e6e", "#b45bd0", "#d05a5a", "#4a86d8", "#8a8f2f"]

export type DetailProps = {
  node: Node | null
  hours: number
  windows: { hours: number; label: string }[]
  onHours: (hours: number) => void
  onBack: () => void
}

type Tab = "resources" | "latency"

export function NodeDetail({ node, hours, windows, onHours, onBack }: DetailProps) {
  const [tab, setTab] = useState<Tab>("resources")
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  // Smoothing is a reading aid, not a setting: it lives with the tab that uses
  // it and is off until asked for, so the raw readings stay the default.
  // Two different jobs, so two switches: averaging softens the whole line,
  // despiking only removes the readings that jump out of their neighbourhood.
  const [avg, setAvg] = useState(false)
  const [spike, setSpike] = useState(false)
  const points = usePointCount()

  if (!node) {
    return (
      <>
        <div className="doc-head">
          <div className="crumb">
            <a href="/" onClick={(e) => { e.preventDefault(); onBack() }}>首页</a>
            <span className="sep">/</span>
            <span>节点</span>
          </div>
          <h1 className="doc-title">找不到这个节点</h1>
        </div>
        <div className="empty-state">它可能已被删除，或者不属于这个站点。</div>
      </>
    )
  }

  const m = node.metrics
  const left = node.expires_in !== undefined ? node.expires_in : daysUntil(node.expires_at)
  const flag = flagOf(node.country ?? "")

  return (
    <>
      <div className="back-bar">
        <button type="button" className="back-btn" onClick={onBack}>
          <IconChevronLeft width={15} height={15} />
          返回节点列表
        </button>
      </div>

      <div className="doc-head">
        <div className="crumb">
          <a href="/" onClick={(e) => { e.preventDefault(); onBack() }}>
            首页
          </a>
          <span className="sep">/</span>
          <span>节点</span>
          <span className="sep">/</span>
          <span>{node.name}</span>
        </div>
        <h1 className="doc-title">
          {flag ? <span style={{ marginRight: 8 }}>{flag}</span> : null}
          {node.name}
        </h1>
        <p className="doc-lead">
          {node.online
            ? m
              ? `在线，已运行 ${uptime(m.uptime)}。`
              : "已连接，正在等待第一份指标。"
            : node.last_seen_ago === null
              ? "这个节点还没有安装 agent，或从未上报过。"
              : `离线，上次上报于 ${span(sinceSeen(node))}前。`}
        </p>
      </div>

      <Facts node={node} left={left} />

      <section className="section" id="charts">
        <div className="toolbar">
          <div className="tabs" role="group" aria-label="指标类型">
            <button className="tab" aria-pressed={tab === "resources"} onClick={() => setTab("resources")}>
              资源
            </button>
            <button className="tab" aria-pressed={tab === "latency"} onClick={() => setTab("latency")}>
              网络延迟
            </button>
          </div>
          <div className="right">
            {tab === "latency" ? (
              <div className="aids" role="group" aria-label="曲线处理">
                <button
                  type="button"
                  className="tab tab-icon"
                  aria-pressed={avg}
                  onClick={() => setAvg((on) => !on)}
                  title="用相邻几次探测的平均值画线，抹掉抖动，整条曲线都会变平缓"
                >
                  <IconSmooth width={13} height={13} />
                  平滑
                </button>
                <button
                  type="button"
                  className="tab tab-icon"
                  aria-pressed={spike}
                  onClick={() => setSpike((on) => !on)}
                  title="只把孤立的尖峰换成邻近点的中位数，其余读数原样保留"
                >
                  <IconFilter width={13} height={13} />
                  削峰
                </button>
              </div>
            ) : null}
            <div className="tabs" role="group" aria-label="时间范围">
              {windows.map((w) => (
                <button key={w.hours} className="tab" aria-pressed={hours === w.hours} onClick={() => onHours(w.hours)}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tab === "resources" ? (
          <ResourceCharts node={node} hours={hours} points={points} />
        ) : (
          <LatencyCharts
            node={node}
            hours={hours}
            points={points}
            hidden={hidden}
            setHidden={setHidden}
            avg={avg}
            spike={spike}
          />
        )}
      </section>
    </>
  )
}

/* --------------------------------------------------------------- 事实表 */

function Facts({ node, left }: { node: Node; left: number | null }) {
  const m = node.metrics
  const facts: { label: string; value: string; mono?: boolean }[] = []

  if (node.os) facts.push({ label: "操作系统", value: osName(node.os) })
  if (node.cpu_name) facts.push({ label: "处理器", value: node.cpu_name })
  if (node.cpu_cores) facts.push({ label: "核心数", value: `${node.cpu_cores} 核` })
  if (node.arch) facts.push({ label: "架构", value: node.arch })
  if (node.kernel) facts.push({ label: "内核", value: node.kernel, mono: true })
  if (node.virt) facts.push({ label: "虚拟化", value: node.virt })
  if (node.group) facts.push({ label: "分组", value: node.group })
  if (node.agent_version) facts.push({ label: "agent", value: node.agent_version, mono: true })
  if (m) facts.push({ label: "内存", value: pair(m.mem_used, m.mem_total) })
  if (m) facts.push({ label: "硬盘", value: pair(m.disk_used, m.disk_total) })
  if (m && m.swap_total > 0) facts.push({ label: "交换分区", value: pair(m.swap_used, m.swap_total) })
  if (m) facts.push({ label: "连接数", value: `TCP ${m.tcp} · UDP ${m.udp} · 进程 ${m.procs}` })
  if (node.price > 0) {
    facts.push({ label: "价格", value: `${money(node.price, node.currency || "CNY")} / ${cycle(node.billing_cycle || "monthly")}` })
  } else {
    facts.push({ label: "价格", value: "免费" })
  }
  if (node.expires_at) {
    facts.push({
      label: "到期",
      value: `${date(node.expires_at)}${left === null ? "" : left < 0 ? `（已过期 ${-left} 天）` : `（还有 ${left} 天）`}`,
    })
  } else if (left === null) {
    facts.push({ label: "到期", value: FOREVER })
  }
  if (node.traffic_limit > 0) facts.push({ label: "流量上限", value: bytes(node.traffic_limit) })

  if (!facts.length) return null
  return (
    <dl className="facts" id="summary">
      {facts.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd className={f.mono ? "mono" : undefined} title={f.value}>
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------- 资源图表 */

function ResourceCharts({ node, hours, points }: { node: Node; hours: number; points: number }) {
  const { data, error, loading } = useSeries<History>(node.id, hours, "metrics", points)
  const history = useMemo(() => rowsOf(data), [data])
  const m = node.metrics

  // A row the hub sent without a usable stamp cannot be placed on the time
  // axis, and one field of the wrong type must not blank the whole chart.
  const rows = useMemo(
    () =>
      history.metrics
        .filter((r) => r && Number.isFinite(r.ts) && r.ts > 0)
        .map((r) => ({ ...r, ts: r.ts * 1000 }))
        .sort((a, b) => a.ts - b.ts),
    [history],
  )
  const gaps = useMemo(() => withGaps(rows) as Row[], [rows])
  const ticks = useMemo(() => timeTicks(rows[0]?.ts ?? Date.now() - hours * 3600_000, rows.at(-1)?.ts ?? Date.now()), [rows, hours])
  const formatX = useMemo(() => tickClock(ticks, hours), [ticks, hours])
  const tipTime = useMemo(() => clockFor(hours), [hours])

  if (error) return <div className="alert danger">{error}</div>
  if (loading && !data) return <Skeleton />
  if (!rows.length) return <div className="empty-state">这段时间没有历史数据。可能是 hub 尚未积累，或节点一直离线。</div>

  const total = m?.mem_total ?? node.mem_total
  const disk = m?.disk_total ?? node.disk_total
  const peak = Math.max(...rows.map((r) => Math.max(num(r.cpu) ?? 0, num(r.cpu_max) ?? 0)), 10)
  const cpuTop = axisTop(peak, 25, 100)

  // An older hub reports no `cpu_max` at all; the legend then has one entry
  // rather than an empty line. A gap row carries only `ts`, so every series
  // reads through `num`, which turns a missing or mistyped field into a break
  // instead of an NaN that would erase the whole path.
  const hasPeak = rows.some((r) => typeof r.cpu_max === "number")
  const charts: { key: string; title: string; series: ChartSeries[]; domain: [number, number]; yticks: number[]; fmt: (v: number) => string }[] = [
    {
      key: "cpu",
      title: "CPU 使用率",
      series: [
        { label: "平均", color: "var(--accent)", points: gaps.map((r) => num((r as Row).cpu)), area: true },
        ...(hasPeak
          ? [{ label: "峰值", color: "var(--fg-faint)", points: gaps.map((r) => num((r as Row).cpu_max)), dash: true }]
          : []),
      ],
      domain: [0, cpuTop],
      yticks: quarters(cpuTop),
      fmt: (v) => `${Math.round(v)}%`,
    },
  ]

  if (total > 0) {
    charts.push({
      key: "mem",
      title: "内存使用率",
      series: [{ label: "已用", color: "var(--accent)", points: gaps.map((r) => share((r as Row).mem_used, total)), area: true }],
      domain: [0, 100],
      yticks: quarters(100),
      fmt: (v) => `${Math.round(v)}%`,
    })
  }

  if (disk > 0) {
    charts.push({
      key: "disk",
      title: "硬盘使用率",
      series: [{ label: "已用", color: "var(--accent)", points: gaps.map((r) => share((r as Row).disk_used, disk)), area: true }],
      domain: [0, 100],
      yticks: quarters(100),
      fmt: (v) => `${Math.round(v)}%`,
    })
  }

  const netPeak = Math.max(...rows.map((r) => Math.max(num(r.net_rx) ?? 0, num(r.net_tx) ?? 0, num(r.net_rx_max) ?? 0, num(r.net_tx_max) ?? 0)), RATE_FLOOR * 2)
  const net = rateAxis(RATE_FLOOR, netPeak)
  charts.push({
    key: "net",
    title: "网络速率",
    series: [
      { label: "下行", color: "var(--accent)", points: gaps.map((r) => num((r as Row).net_rx)) },
      { label: "上行", color: "#e08a3c", points: gaps.map((r) => num((r as Row).net_tx)) },
    ],
    domain: net.domain,
    yticks: net.ticks,
    fmt: axisBytes,
  })

  return (
    <>
      {charts.map((c) => (
        <div className="chart-card" key={c.key}>
          <div className="chart-head">
            <h4>{c.title}</h4>
            <div className="legend">
              {c.series.map((s) => (
                <span key={s.label}>
                  <i className={s.dash ? "dash" : undefined} style={{ color: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <Chart
            rows={gaps}
            series={c.series}
            yDomain={c.domain}
            yTicks={c.yticks}
            xTicks={ticks}
            formatY={c.fmt}
            formatX={formatX}
            formatTip={c.key === "net" ? rate : c.fmt}
            tipTime={tipTime}
            log={c.key === "net"}
            empty="没有数据"
          />
        </div>
      ))}
    </>
  )
}

/* ------------------------------------------------------------- 延迟图表 */

function LatencyCharts({
  node,
  hours,
  points,
  hidden,
  setHidden,
  avg,
  spike,
}: {
  node: Node
  hours: number
  points: number
  hidden: Set<string>
  setHidden: (next: Set<string>) => void
  avg: boolean
  spike: boolean
}) {
  const { data, error, loading } = useSeries<History>(node.id, hours, "ping", points)
  const history = useMemo(() => rowsOf(data), [data])

  const ids = useMemo(() => {
    const seen: string[] = []
    for (const row of history.ping) {
      if (!row || !Number.isFinite(row.ts)) continue
      if (!seen.includes(row.task_id)) seen.push(row.task_id)
    }
    return seen
  }, [history])

  const shown = ids.filter((id) => !hidden.has(id))
  const times = useMemo(() => [...new Set(history.ping.map((r) => r.ts))].filter((t) => Number.isFinite(t)).sort((a, b) => a - b), [history])
  const ticks = useMemo(() => timeTicks(times[0] ? times[0] * 1000 : Date.now() - hours * 3600_000, times.at(-1) ? times.at(-1)! * 1000 : Date.now()), [times, hours])
  const formatX = useMemo(() => tickClock(ticks, hours), [ticks, hours])
  const tipTime = useMemo(() => clockFor(hours), [hours])

  if (error) return <div className="alert danger">{error}</div>
  if (loading && !data) return <Skeleton />
  if (!ids.length) return <div className="empty-state">这段时间没有延迟记录。延迟监控需要在面板里配置探测任务。</div>

  // Despiking runs before smoothing: a spike removed from a raw series leaves
  // its neighbours untouched, whereas averaging first would spread the spike
  // over five points and the filter would no longer see one outlier.
  // Neither touches the nulls: a failed probe is a hole, not a high reading.
  const series: ChartSeries[] = shown.map((id) => {
    const byTime = new Map<number, number | null>()
    for (const row of history.ping) if (row.task_id === id) byTime.set(row.ts * 1000, typeof row.latency === "number" ? row.latency : null)
    const raw = times.map((t) => byTime.get(t * 1000) ?? null)
    const spiked = spike ? despike(raw) : raw
    const points = avg ? smooth(spiked) : spiked
    return {
      label: history.probes[id] || id,
      color: PALETTE[ids.indexOf(id) % PALETTE.length],
      points,
    }
  })

  const values = series.flatMap((s) => s.points).filter((v): v is number => typeof v === "number")
  const top = axisTop(Math.max(...values, 20), 50, 100_000)
  const rows = times.map((t) => ({ ts: t * 1000 }))

  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else if (ids.length > next.size + 1) next.add(id)
    setHidden(next)
  }

  return (
    <>
      <div className="chart-card">
        <div className="chart-head">
          <h4>延迟</h4>
          <div className="legend">
            <span>毫秒，越低越好{spike ? " · 已削峰" : ""}{avg ? " · 已平滑" : ""}</span>
          </div>
        </div>
        <Chart
          rows={rows}
          series={series}
          height={220}
          yDomain={[0, top]}
          yTicks={quarters(top)}
          xTicks={ticks}
          formatY={(v) => `${Math.round(v)}`}
          formatTip={(v) => `${v.toFixed(1)} ms`}
          formatX={formatX}
          tipTime={tipTime}
          empty="没有延迟数据"
        />
      </div>

      <div className="probes">
        {ids.map((id) => {
          // `loss` is already a percentage of the window, not a fraction: the
          // hub divides by the sample count before sending it. Clamped so a
          // broken hub cannot print 1607%.
          const raw = num(history.loss[id])
          const loss = raw === null ? 0 : Math.min(100, Math.max(0, raw))
          const on = !hidden.has(id)
          return (
            <button key={id} className="probe" aria-pressed={on} onClick={() => toggle(id)} title={on ? "点击隐藏" : "点击显示"}>
              <i style={{ background: PALETTE[ids.indexOf(id) % PALETTE.length], opacity: on ? 1 : 0.3 }} />
              {history.probes[id] || id}
              {loss > 0 ? (
                <span className="loss">丢包 {loss < 1 ? "<1" : Math.round(loss)}%</span>
              ) : null}
            </button>
          )
        })}
      </div>

    </>
  )
}

function Skeleton() {
  return (
    <div className="chart-card">
      <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 170 }} />
    </div>
  )
}
