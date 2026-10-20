import { memo } from "react"

import type { Node } from "@/lib/api"
import { bytes, cycle, daysUntil, flagOf, money, osName, percent, rate, sinceSeen, span, uptime } from "@/lib/format"
import { IconArrowDown, IconArrowUp, IconChevronRight } from "@/components/icons"
import { Meter, monthUsage } from "@/components/Summary"

/**
 * The "one big card" layout: every node in the group lives inside a single
 * bordered card, one hairline-separated row each, so a visitor reads the group
 * as one document rather than a wall of tiles. The columns are the same facts
 * the small card carries, in the same order, so switching layouts loses nothing.
 */

const deployed = (node: Node) => node.cpu_cores > 0 || node.mem_total > 0

/** Days left, from the hub's calendar where it says so, else from the browser's clock. */
function remaining(node: Node): number | null {
  if (node.expires_in !== undefined) return node.expires_in
  return daysUntil(node.expires_at)
}

function Status({ node }: { node: Node }) {
  const never = node.last_seen_ago === null
  if (node.online) {
    return (
      <span className="status on">
        <i className="dot" />
        {node.metrics ? "在线" : "已连接"}
      </span>
    )
  }
  return (
    <span className={never ? "status never" : "status"}>
      <i className="dot" />
      {never ? "未接入" : `离线 ${span(sinceSeen(node))}`}
    </span>
  )
}

const Row = memo(function Row({
  node,
  usage,
  price,
  remark,
  onOpen,
}: {
  node: Node
  usage: boolean
  price: boolean
  remark: boolean
  onOpen: (id: number) => void
}) {
  const m = node.metrics
  const flag = flagOf(node.country ?? "")
  const left = remaining(node)
  const expired = left !== null && left < 0
  const soon = left !== null && left >= 0 && left <= 7
  const quota = node.traffic_limit > 0 ? percent(monthUsage(node), node.traffic_limit) : null
  const seen = sinceSeen(node)
  const never = node.last_seen_ago === null

  return (
    <button type="button" className="panel-row" onClick={() => onOpen(node.id)} aria-label={`${node.name} 详情`}>
      <div className="panel-identity">
        <div className="card-title">
          {flag ? <span className="flag">{flag}</span> : null}
          <h3>{node.name}</h3>
        </div>
        <div className="card-sub">
          {deployed(node)
            ? [osName(node.os ?? ""), node.cpu_cores > 0 ? `${node.cpu_cores} 核` : "", node.arch ?? ""].filter(Boolean).join(" · ")
            : "尚未上报硬件信息"}
        </div>
        {remark && node.public_remark ? <p className="remark">{node.public_remark}</p> : null}
        <div className="panel-status">
          <Status node={node} />
          {m ? (
            <>
              <span className="io" title="下行">
                <IconArrowDown width={12} height={12} />
                {rate(m.net_rx)}
              </span>
              <span className="io" title="上行">
                <IconArrowUp width={12} height={12} />
                {rate(m.net_tx)}
              </span>
            </>
          ) : null}
          {m && node.online && m.uptime ? <span className="io">已运行 {uptime(m.uptime)}</span> : null}
        </div>
      </div>

      <div className="panel-meters">
        {m && usage ? (
          <>
            <Meter label="CPU" value={m.cpu} used={`${Math.round(m.cpu)}%`} hint={`负载 ${m.load[0].toFixed(2)}`} />
            <Meter label="内存" value={percent(m.mem_used, m.mem_total)} used={bytes(m.mem_used)} total={bytes(m.mem_total)} />
            <Meter label="硬盘" value={percent(m.disk_used, m.disk_total)} used={bytes(m.disk_used)} total={bytes(m.disk_total)} />
            <Meter
              label={node.traffic_limit > 0 ? "本月流量" : "交换分区"}
              value={quota ?? percent(m.swap_used, m.swap_total)}
              used={quota !== null ? bytes(monthUsage(node)) : bytes(m.swap_used)}
              total={quota !== null ? bytes(node.traffic_limit) : bytes(m.swap_total)}
            />
          </>
        ) : (
          <p className="panel-note">
            {m
              ? "资源使用情况已在设置中隐藏。"
              : node.online
                ? "已连上，正在等待第一份指标。"
                : never
                  ? "这个节点还没有安装 agent 或从未上报过。"
                  : `上次上报于 ${span(seen)}前。`}
          </p>
        )}
      </div>

      <div className="panel-side">
        {price ? (
          <div className="panel-price">
            {node.price > 0 ? (
              <span className="amount">
                {money(node.price, node.currency || "CNY")}
                <span className="sep">/</span>
                {cycle(node.billing_cycle || "monthly")}
              </span>
            ) : (
              <span className="amount free">免费</span>
            )}
            <span className={expired ? "danger" : soon ? "warn" : "muted"}>
              {left === null ? "无限" : expired ? `已过期 ${-left} 天` : `${left} 天后到期`}
            </span>
          </div>
        ) : null}
        <IconChevronRight width={14} height={14} className="panel-go" />
      </div>
    </button>
  )
})

export function Panel({
  nodes,
  title,
  usage,
  price,
  remark,
  onOpen,
}: {
  nodes: Node[]
  /** The group the card holds, or empty for the whole fleet. */
  title: string
  usage: boolean
  price: boolean
  remark: boolean
  onOpen: (id: number) => void
}) {
  const online = nodes.filter((n) => n.online).length
  return (
    <div className="panel-card">
      <div className="panel-head">
        <h3>{title || "全部节点"}</h3>
        <span>
          {online} / {nodes.length} 在线
        </span>
      </div>
      {nodes.map((n) => (
        <Row key={n.id} node={n} usage={usage} price={price} remark={remark} onOpen={onOpen} />
      ))}
    </div>
  )
}
