/**
 * A stand-in for the hub, for looking at the theme without a real deployment.
 *
 *   node scripts/mock.mjs            # http://127.0.0.1:9911
 *   MONITOR_PORT=8080 node scripts/mock.mjs
 *
 * It serves dist/ as static files, answers the five read-only endpoints with
 * generated data, and pushes the node list over a WebSocket every two seconds
 * the way the hub does. Nothing here ships: it is not part of the theme.
 */
import { createReadStream, existsSync, statSync } from "node:fs"
import { createHash } from "node:crypto"
import { extname, join, normalize } from "node:path"
import { createServer } from "node:http"

const PORT = Number(process.env.MONITOR_PORT ?? 9911)
const ROOT = new URL("../dist/", import.meta.url).pathname
// Saved site settings, seeded from the environment so a screenshot can show them.
let saved = JSON.parse(process.env.MONITOR_CONFIG ?? "{}")
const HISTORY_DAYS = Number(process.env.MONITOR_DAYS ?? 30)
const NODES = Number(process.env.MONITOR_NODES ?? 9)

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
}

const PLACES = ["HK", "JP", "SG", "US", "DE"]
const SYSTEMS = [
  "Debian GNU/Linux 12 (bookworm)",
  "Ubuntu 24.04.1 LTS",
  "Alpine Linux v3.20",
  "Rocky Linux 9.4 (Blue Onyx)",
]
const CPUS = ["AMD EPYC 7B13 64-Core Processor", "Intel(R) Xeon(R) Platinum 8259CL CPU @ 2.50GHz", "Ampere Altra Q80-30"]

// A stable pseudo-random stream per node, so a reload draws the same fleet.
const hash = (n) => createHash("sha256").update(String(n)).digest()

const nodes = Array.from({ length: NODES }, (_, i) => {
  const h = hash(i)
  const byte = (k) => h[k % h.length]
  const online = i !== NODES - 1 && i !== 3
  const name = ["hk-edge-01", "hk-edge-02", "jp-tokyo-01", "jp-osaka-01", "sg-core-01", "sg-core-02", "us-west-01", "de-fra-01", "hk-lab-01"][i % 9]
  const group = name.startsWith("hk") ? "香港" : name.startsWith("jp") ? "日本" : name.startsWith("sg") ? "新加坡" : ""
  const cores = [2, 4, 8, 16][byte(1) % 4]
  const mem = [2, 4, 8, 16, 32][byte(2) % 5] * 1024 ** 3
  const disk = [40, 80, 160, 320][byte(3) % 4] * 1024 ** 3
  const used = mem * (0.2 + (byte(4) % 60) / 100)
  const diskUsed = disk * (0.15 + (byte(5) % 70) / 100)
  const traffic = [0, 500, 1000, 2000][byte(6) % 4] * 1024 ** 3
  const monthRx = traffic ? traffic * (0.1 + (byte(7) % 60) / 100) * 0.6 : 0
  const monthTx = traffic ? traffic * (0.1 + (byte(8) % 60) / 100) * 0.4 : 0
  // A mix of currencies, so the remaining-value tile has something to convert.
  // Yen is priced in the hundreds, as a real invoice would be.
  const CURRENCIES = [["CNY", 1], ["USD", 1], ["HKD", 1], ["EUR", 1], ["JPY", 150]]
  const [currency, scale] = CURRENCIES[byte(33) % CURRENCIES.length]
  // One node is a home lab box: no invoice, no expiry date. It is what the
  // "免费 / 无限" branch on the card is there for.
  const free = i === 7
  const price = free ? 0 : [5, 9.9, 12, 24][byte(9) % 4] * scale
  const expires = free ? null : [null, 3, 12, 40, 120, -2][byte(10) % 6]
  const cycles = ["monthly", "quarterly", "semiannual", "yearly", "once"]
  return {
    id: 100 + i,
    name,
    sort: i,
    public: true,
    online,
    country: PLACES[byte(11) % PLACES.length],
    group,
    last_seen: Date.now() / 1000 - (online ? 2 : 3600 * (1 + (byte(12) % 40))),
    last_seen_ago: online ? 2 : 3600 * (1 + (byte(12) % 40)),
    metrics: online
      ? {
          uptime: 86400 * (1 + (byte(13) % 200)) + 3600 * (byte(14) % 24),
          cpu: 3 + (byte(15) % 70),
          load: [0.1 + (byte(16) % 40) / 10, 0.2 + (byte(17) % 30) / 10, 0.2 + (byte(18) % 20) / 10],
          mem_total: mem,
          mem_used: used,
          swap_total: 2 * 1024 ** 3,
          swap_used: 1024 ** 3 * ((byte(19) % 20) / 100),
          disk_total: disk,
          disk_used: diskUsed,
          net_rx: 1024 ** 2 * (0.2 + (byte(20) % 400) / 10),
          net_tx: 1024 ** 2 * (0.1 + (byte(21) % 200) / 10),
          total_rx: 1024 ** 3 * (40 + (byte(22) % 400)),
          total_tx: 1024 ** 3 * (20 + (byte(23) % 200)),
          month_rx: monthRx,
          month_tx: monthTx,
          tcp: 40 + (byte(24) % 300),
          udp: 4 + (byte(25) % 30),
          procs: 80 + (byte(26) % 300),
        }
      : null,
    os: SYSTEMS[byte(27) % SYSTEMS.length],
    kernel: "6.1.0-" + (10 + (byte(28) % 20)) + "-amd64",
    arch: "amd64",
    virt: ["KVM", "LXC", "Docker", ""][byte(29) % 4],
    cpu_name: CPUS[byte(30) % CPUS.length],
    cpu_cores: cores,
    mem_total: mem,
    swap_total: 2 * 1024 ** 3,
    disk_total: disk,
    agent_version: "1.4." + (byte(31) % 6),
    price,
    currency,
    billing_cycle: cycles[byte(32) % cycles.length],
    expires_at: expires === null ? null : new Date(Date.now() + expires * 86400000).toISOString().slice(0, 10),
    expires_in: expires,
    traffic_limit: traffic,
    traffic_mode: ["sum", "up", "down"][byte(33) % 3],
    traffic_reset_day: 1,
    total_rx: 1024 ** 3 * (40 + (byte(34) % 400)),
    total_tx: 1024 ** 3 * (20 + (byte(35) % 200)),
    month_rx: monthRx,
    month_tx: monthTx,
    month_used: monthRx + monthTx,
    month_start: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10),
    day_rx: 1024 ** 2 * (200 + (byte(36) % 4000)),
    day_tx: 1024 ** 2 * (100 + (byte(37) % 2000)),
    public_remark: byte(38) % 3 === 0 ? "" : ["年付优惠，流量不清零。", "适合轻量建站与代理。", "测试机，随时可能重装。"][byte(39) % 3],
  }
})

/** A metric history that looks like a hub's: a slow wave, noise, and a hole where the node was offline. */
function series(node, hours, points, kind) {
  const step = Math.max(60, Math.round((hours * 3600) / points / 60) * 60)
  const count = Math.min(points, Math.floor((hours * 3600) / step))
  const end = Math.floor(Date.now() / 1000 / step) * step
  const seed = hash(node.id + kind)
  const rows = []
  for (let i = 0; i < count; i++) {
    const ts = end - (count - 1 - i) * step
    const wave = Math.sin((i / count) * Math.PI * 3 + node.id)
    const noise = ((seed[i % seed.length] / 255) - 0.5) * 8
    // One node loses a stretch of history, so the gap drawing is exercised.
    const offline = node.id % 5 === 0 && i > count * 0.35 && i < count * 0.45
    // A node that was down reports nothing at all, so the hub emits no row.
    if (offline) continue
    const m = node.metrics
    rows.push({
      ts,
      cpu: Math.max(1, Math.min(99, (m ? m.cpu : 20) + wave * 12 + noise)),
      cpu_max: Math.min(100, (m ? m.cpu : 20) + wave * 12 + noise + 18),
      mem_used: (m ? m.mem_used : 1024 ** 3) * (1 + wave * 0.02),
      swap_used: m ? m.swap_used : 0,
      disk_used: m ? m.disk_used : 10 * 1024 ** 3,
      net_rx: (m ? m.net_rx : 1024 ** 2) * (1 + wave * 0.5 + noise / 40),
      net_tx: (m ? m.net_tx : 1024 ** 2) * (1 + wave * 0.4 + noise / 60),
      net_rx_max: (m ? m.net_rx : 1024 ** 2) * 2,
      net_tx_max: (m ? m.net_tx : 1024 ** 2) * 1.8,
      tcp: 40 + Math.round(wave * 20 + 120),
      udp: 8,
      procs: 180 + Math.round(wave * 10),
      minutes: step / 60,
    })
  }
  return rows
}

const PROBES = { "1": "电信", "2": "联通", "3": "移动", "4": "海外" }

function ping(node, hours, points) {
  const step = Math.max(60, Math.round((hours * 3600) / points / 60) * 60)
  const count = Math.min(points, Math.floor((hours * 3600) / step))
  const end = Math.floor(Date.now() / 1000 / step) * step
  const seed = hash(node.id + "ping")
  const rows = []
  for (let i = 0; i < count; i++) {
    const ts = end - (count - 1 - i) * step
    for (const id of Object.keys(PROBES)) {
      const wave = Math.sin((i / count) * Math.PI * 2 + Number(id)) * 4
      const base = 20 + Number(id) * 12 + wave + (seed[(i + Number(id)) % seed.length] / 255) * 6
      const lost = (seed[(i * 3 + Number(id)) % seed.length] / 255) > 0.94
      // A handful of readings jump several times above the line, the way a real
      // probe does when the path hiccups: that is what 平滑削峰 is for. Placed by
      // index, not by hash, so every probe gets a few no matter its seed.
      const spike = !lost && (i + Number(id) * 3) % 37 === 7
      const value = spike ? base * (2.4 + (seed[(i + 5) % seed.length] / 255) * 1.6) : base
      rows.push({
        task_id: id,
        ts,
        latency: lost ? null : Math.round(value * 10) / 10,
        band: lost ? undefined : [value * 0.8, value * 1.3],
        loss: lost ? 1 : 0,
      })
    }
  }
  return rows
}

const json = (res, body, status = 200) => {
  const text = JSON.stringify(body)
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) })
  res.end(text)
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost")
  const path = url.pathname

  if (path === "/api/me") {
    // MONITOR_ANON=1 previews what a visitor sees: no gear, no settings drawer.
    const anon = process.env.MONITOR_ANON === "1"
    return json(res, { authed: !anon, github: !anon, site_name: "状态文档", public_page: true, history_days: HISTORY_DAYS })
  }
  if (path === "/api/nodes") {
    // MONITOR_FAIL=503 makes the hub answer the way it does when it is down or
    // the visitor is not allowed in: one line of Chinese text.
    const fail = Number(process.env.MONITOR_FAIL ?? 0)
    if (fail) {
      res.writeHead(fail, { "content-type": "text/plain; charset=utf-8" })
      return res.end(process.env.MONITOR_FAIL_TEXT ?? "站点暂时不可用，请稍后再试")
    }
    return json(res, { nodes })
  }

  const metrics = path.match(/^\/api\/nodes\/(\d+)\/metrics$/)
  if (metrics) {
    const node = nodes.find((n) => n.id === Number(metrics[1]))
    if (!node) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
      return res.end("找不到这个节点")
    }
    const hours = Math.min(Number(url.searchParams.get("hours") ?? 6), HISTORY_DAYS * 24)
    const points = Math.min(1440, Math.max(60, Number(url.searchParams.get("points") ?? 240)))
    // The hub answers both series in one object, whichever was asked for: the
    // other comes back as an empty array. `step` rides along either way.
    const kind = url.searchParams.get("series") === "ping" ? "ping" : "metrics"
    const rows = kind === "metrics" ? series(node, hours, points, kind) : []
    const pinged = kind === "ping" ? ping(node, hours, points) : []
    const step = Math.max(60, Math.round((hours * 3600) / points / 60) * 60)
    return json(res, {
      metrics: rows,
      ping: pinged,
      probes: kind === "ping" ? PROBES : {},
      // The hub sends these already divided by the window's sample count, so a
      // value here is a percentage, not a fraction.
      loss: kind === "ping" ? { "2": 2.4, "3": 11.7 } : {},
      step,
    })
  }

  // A stand-in for whatever quote API an operator points the theme at: the
  // 一言 shape, so the parser is exercised against the common case.
  if (path === "/mock/quote") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" })
    res.end(JSON.stringify({ hitokoto: "机器会坏，记录不会。", from: "运维老张", from_who: "运维老张" }))
    return
  }

  if (path === "/api/themes/doc/config") {
    if (req.method === "PUT") {
      let body = ""
      req.on("data", (c) => (body += c))
      req.on("end", () => {
        try {
          // The hub replaces the whole object, so a save is visible to the next
          // load without a restart.
          const next = JSON.parse(body || "{}")
          if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error("bad body")
          saved = next
          res.writeHead(204)
          res.end()
        } catch {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" })
          res.end("设置格式不对")
        }
      })
      return
    }
    // MONITOR_CONFIG='{"dark":"dark"}' seeds site settings without a hub.
    return json(res, saved)
  }

  // Anything else is a static file, falling back to index.html the way the hub does.
  const rel = normalize(path).replace(/^(\.\.[/\\])+/, "")
  let file = join(ROOT, rel)
  if (!existsSync(file) || !statSync(file).isFile()) file = join(ROOT, "index.html")
  const type = TYPES[extname(file)] ?? "application/octet-stream"
  res.writeHead(200, { "content-type": type })
  createReadStream(file).pipe(res)
})

// The hub's push: the whole list every two seconds, gzipped when asked.
import { gzipSync } from "node:zlib"

server.on("upgrade", (req, socket) => {
  if (!req.url?.startsWith("/api/ws")) return socket.destroy()
  const key = req.headers["sec-websocket-key"]
  const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64")
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  )
  const frame = (payload) => {
    const len = payload.length
    const head = len < 126 ? Buffer.from([0x82, len]) : len < 65536 ? Buffer.from([0x82, 126, len >> 8, len & 255]) : (() => {
      const b = Buffer.alloc(10)
      b[0] = 0x82
      b[1] = 127
      b.writeBigUInt64BE(BigInt(len), 2)
      return b
    })()
    socket.write(Buffer.concat([head, payload]))
  }
  const timer = setInterval(() => {
    const text = JSON.stringify({ nodes })
    frame(req.url.includes("gzip") ? gzipSync(text) : Buffer.from(text))
  }, 2000)
  socket.on("close", () => clearInterval(timer))
  socket.on("error", () => clearInterval(timer))
})

server.listen(PORT, () => console.log(`mock hub on http://127.0.0.1:${PORT}`))
