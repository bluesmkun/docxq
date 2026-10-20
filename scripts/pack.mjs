// Builds theme.tar.gz: theme.json, preview.png and dist/ at the archive root,
// which is the shape the hub installs. It unpacks into a staging directory,
// reads `theme.json` from the top of it, and renames the directory to the
// manifest's `short` — so an extra `<short>/` level would leave it without a
// manifest. The tar must be complete (a truncated gzip is rejected) and must
// carry nothing but plain files and directories.
//
//   node scripts/pack.mjs            # after `npm run build`
//
// Sizes are checked against the limits the hub enforces, so a theme that packs
// here also installs there.

import { createHash } from "node:crypto"
import { readFile, readdir, stat, writeFile } from "node:fs/promises"
import { gzipSync } from "node:zlib"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const LIMIT = {
  archive: 32 * 1024 * 1024,
  unpacked: 64 * 1024 * 1024,
  file: 8 * 1024 * 1024,
  entries: 2000,
  padding: 1024 * 1024,
}

const manifest = JSON.parse(await readFile(join(root, "theme.json"), "utf8"))
const short = manifest.short
if (!/^[A-Za-z0-9_-]+$/.test(short ?? "")) {
  throw new Error(`theme.json: short 必须是字母、数字、- 或 _，现在是 ${JSON.stringify(short)}`)
}
for (const key of ["name", "short", "description", "version", "author", "url"]) {
  if (typeof manifest[key] !== "string") throw new Error(`theme.json: 缺少字符串字段 ${key}`)
}

/** Everything that goes into the package, as paths relative to the theme dir. */
async function collect() {
  const out = []
  const walk = async (abs, rel) => {
    const info = await stat(abs)
    if (info.isDirectory()) {
      out.push({ rel, dir: true })
      const names = (await readdir(abs)).sort()
      for (const name of names) {
        if (name === ".DS_Store") continue
        await walk(join(abs, name), `${rel}/${name}`)
      }
      return
    }
    if (!info.isFile()) throw new Error(`不打包非普通文件：${rel}`)
    out.push({ rel, size: info.size, abs })
  }
  await walk(join(root, "theme.json"), "theme.json")
  const preview = join(root, "preview.png")
  if (await stat(preview).then(() => true, () => false)) {
    await walk(preview, "preview.png")
  } else {
    console.warn("· 没有 preview.png，面板里会是空白缩略图")
  }
  await walk(join(root, "dist"), "dist")
  return out
}

// ustar header fields, in order: name, mode, uid, gid, size, mtime, chksum,
// typeflag, linkname, magic, version, uname, gname, devmajor, devminor, prefix.
function header(name, size, mode, type) {
  const block = Buffer.alloc(512)
  const put = (str, offset, length) => block.write(str, offset, length, "utf8")
  // Our paths are short, so a plain name field is enough — but reject anything
  // that would silently truncate at 100 bytes instead of splitting on prefix.
  if (Buffer.byteLength(name) > 100) throw new Error(`路径过长（>100 字节）：${name}`)
  put(name, 0, 100)
  put(`${mode.toString(8).padStart(7, "0")}\u0000`, 100, 8)
  put("0000000\u0000", 108, 8)
  put("0000000\u0000", 116, 8)
  put(`${size.toString(8).padStart(11, "0")}\u0000`, 124, 12)
  put("00000000000\u0000", 136, 12)
  block.fill(0x20, 148, 156)
  put(type, 156, 1)
  put("ustar\u000000", 257, 8)
  put("root", 265, 32)
  put("root", 297, 32)
  // checksum: sum of all header bytes with the checksum field read as spaces
  let sum = 0
  for (const byte of block) sum += byte
  put(`${sum.toString(8).padStart(6, "0")}\u0000 `, 148, 8)
  return block
}

const entries = await collect()
const files = entries.filter((e) => !e.dir)
const unpacked = files.reduce((n, e) => n + e.size, 0)
if (entries.length > LIMIT.entries) throw new Error(`条目数 ${entries.length} 超过 ${LIMIT.entries}`)
if (unpacked > LIMIT.unpacked) throw new Error(`解开后 ${unpacked} 字节超过 64 MiB`)
for (const f of files) {
  if (f.size > LIMIT.file) throw new Error(`${f.rel} 有 ${f.size} 字节，超过单文件 8 MiB`)
}
// Both are read from the archive root by the installer: the manifest names the
// theme, index.html is the one file `serve` requires.
for (const required of ["theme.json", "dist/index.html"]) {
  if (!files.some((f) => f.rel === required)) throw new Error(`缺少 ${required}`)
}

const chunks = []
for (const entry of entries) {
  // theme.json sits at the archive root: the hub unpacks into a staging
  // directory, reads `theme.json` there, and names the installed directory
  // after its `short`. An extra <short>/ level would hide the manifest and the
  // install would be refused for having no theme.json at all.
  const name = entry.rel
  if (entry.dir) {
    chunks.push(header(`${name}/`, 0, 0o755, "5"))
    continue
  }
  const body = await readFile(entry.abs)
  chunks.push(header(name, body.length, 0o644, "0"), body)
  const pad = (512 - (body.length % 512)) % 512
  if (pad) chunks.push(Buffer.alloc(pad))
}
// Two zero blocks end the archive; gzip then gets its own framing. Nothing else
// is appended, so there is no trailer padding for the hub to trip over.
chunks.push(Buffer.alloc(1024))
const tar = Buffer.concat(chunks)

const gz = gzipSync(tar, { level: 9 })
if (gz.length > LIMIT.archive) throw new Error(`打包后 ${gz.length} 字节超过 32 MiB`)
const out = join(root, "theme.tar.gz")
await writeFile(out, gz)

// Read the names back out of the tar we just built, the way the hub sees them:
// it unpacks into a staging directory and looks for `theme.json` at the top of
// it. An extra <short>/ level is what breaks that, and it is cheap to check.
const names = []
for (let offset = 0; offset + 512 <= tar.length; ) {
  const block = tar.subarray(offset, offset + 512)
  if (block.every((byte) => byte === 0)) break
  const name = block.toString("utf8", 0, block.indexOf(0) === -1 ? 100 : Math.min(block.indexOf(0), 100))
  const size = parseInt(block.toString("utf8", 124, 136).replace(/\0.*$/, "").trim() || "0", 8)
  names.push(name)
  offset += 512 + Math.ceil(size / 512) * 512
}
if (names[0] !== "theme.json") {
  throw new Error(`theme.tar.gz 的第一项是 ${JSON.stringify(names[0])}，不是根目录的 theme.json：hub 会以「主题包里没有 theme.json」拒绝安装`)
}
if (!names.includes("dist/index.html")) throw new Error("theme.tar.gz 里没有 dist/index.html")

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(`theme.tar.gz  ${kb(gz.length)}（压缩前 ${kb(tar.length)}）`)
console.log(`  ${short}（short）  ${files.length} 个文件，${entries.length} 个条目`)
console.log(`  sha256 ${createHash("sha256").update(gz).digest("hex").slice(0, 16)}…`)
console.log(`  余量：整包 ${kb(LIMIT.archive - gz.length)}，解压 ${kb(LIMIT.unpacked - unpacked)}`)
console.log("  用 `gzip -t theme.tar.gz` 复核完整性")
