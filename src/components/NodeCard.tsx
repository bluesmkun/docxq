import { memo } from "react"

import type { Node } from "@/lib/api"
import { bytes, cycle, daysUntil, flagOf, money, osName, percent, rate, sinceSeen, span, uptime } from "@/lib/format"
import { IconArrowDown, IconArrowUp } from "@/components/icons"
import { Meter, monthUsage } from "@/components/Summary"

/** A hub that has never received a report has no figures at all, and says so. */
const deployed = (node: Node) => node.cpu_cores > 0 || node.mem_total > 0

/** Days left, from the hub's calendar where it says so, else from the browser's clock. */
function remaining(node: Node): number | null {
  if (node.expires_in !== undefined) return node.expires_in
  return daysUntil(node.expires_at)
}

export type NodeCardProps = {
  node: Node
  columns: number
  usage: boolean
  price: boolean
  remark: boolean
  onOpen: (id: number) => void
}

export const NodeCard = memo(function NodeCard({ node, columns, usage, price, remark, onOpen }: NodeCardProps) {
  const m = node.metrics
  const flag = flagOf(node.country ?? "")
  const left = remaining(node)
  const expired = left !== null && left < 0
  const soon = left !== null && left >= 0 && left <= 7
  const quota = node.traffic_limit > 0 ? percent(monthUsage(node), node.traffic_limit) : null
  const seen = sinceSeen(node)
  const never = node.last_seen_ago === null

  const status = node.online
    ? { text: m ? "在线" : "已连接", cls: "status on" }
    : { text: never ? "未接入" : `离线 ${span(seen)}`, cls: never ? "status never" : "status" }

  return (
    <button
      type="button"
      className="card"
      onClick={() => onOpen(node.id)}
      aria-label={`${node.name} 详情`}
      data-columns={columns}
    >
      <div className="card-head">
        <div className="card-identity">
          <div className="card-title">
            {flag ? <span className="flag">{flag}</span> : null}
            <h3>{node.name}</h3>
          </div>
          <div className="card-sub">
            {deployed(node)
              ? [osName(node.os ?? ""), node.cpu_cores > 0 ? `${node.cpu_cores} 核` : "", node.arch ?? ""].filter(Boolean).join(" · ")
              : "尚未上报硬件信息"}
          </div>
        </div>
        <span className={status.cls}>
          <i className="dot" />
          {status.text}
        </span>
      </div>

      {/* The body is a fixed-height box in every card: a node without metrics
          says so in the same space the meters would have taken, so a row of
          cards does not change height when one of them goes offline. */}
      <div className="card-body">
        {m && usage ? (
          <div className="meters">
            <Meter label="CPU" value={m.cpu} used={`${Math.round(m.cpu)}%`} hint={`负载 ${m.load[0].toFixed(2)}`} />
            <Meter label="内存" value={percent(m.mem_used, m.mem_total)} used={bytes(m.mem_used)} total={bytes(m.mem_total)} />
            <Meter label="硬盘" value={percent(m.disk_used, m.disk_total)} used={bytes(m.disk_used)} total={bytes(m.disk_total)} />
            <Meter
              label={node.traffic_limit > 0 ? "本月流量" : "交换分区"}
              value={quota ?? percent(m.swap_used, m.swap_total)}
              used={quota !== null ? bytes(monthUsage(node)) : bytes(m.swap_used)}
              total={quota !== null ? bytes(node.traffic_limit) : bytes(m.swap_total)}
            />
          </div>
        ) : (
          <p className="card-empty-note">
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

      {remark && node.public_remark ? <p className="remark">{node.public_remark}</p> : null}

      {/* Two lines, both always there: the rates on one, the uptime on the next.
          An offline node has no rates and no uptime, and a card that dropped a
          line there would sit shorter than its neighbours in the same row. */}
      <div className="card-foot">
        {m ? (
          <>
            <span className="io" title="下行">
              <IconArrowDown />
              {rate(m.net_rx)}
            </span>
            <span className="io" title="上行">
              <IconArrowUp />
              {rate(m.net_tx)}
            </span>
          </>
        ) : (
          <span className="io">{node.online ? "等待指标" : "无实时数据"}</span>
        )}
        <span className="uptime">{m && node.online && m.uptime ? `已运行 ${uptime(m.uptime)}` : ""}</span>
      </div>

      {price ? (
        <div className="card-price">
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
    </button>
  )
})
