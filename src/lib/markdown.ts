/**
 * A deliberately small Markdown reader for the "about" section. The hub hands
 * the operator's text to the browser, so it is rendered as data and never as
 * HTML: this returns a tree of blocks that React draws with ordinary elements,
 * and there is no path from a string in the settings to `innerHTML`.
 *
 * Supported: headings (#..###), paragraphs, unordered and ordered lists, quotes,
 * fenced code, horizontal rules, and inline **bold**, *italic*, `code`,
 * [links](https://...) and bare https:// links.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "link"; text: string; href: string }

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; spans: Inline[] }
  | { kind: "paragraph"; spans: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "quote"; spans: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "rule" }

/** Only http(s) survives: `javascript:` and `data:` links are dropped, not rendered. */
function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw, location.origin)
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

const LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g
const BARE = /\bhttps?:\/\/[^\s<>()"']+/g

export function inline(text: string): Inline[] {
  const spans: Inline[] = []
  let rest = text

  // Links are taken first, so their label and URL are not read again as
  // emphasis or as a second bare link.
  const parts: { text: string; href?: string }[] = []
  let last = 0
  for (const match of rest.matchAll(LINK)) {
    const at = match.index ?? 0
    if (at > last) parts.push({ text: rest.slice(last, at) })
    const href = safeHref(match[2])
    if (href) parts.push({ text: match[1] || match[2], href })
    else parts.push({ text: match[1] || match[2] })
    last = at + match[0].length
  }
  if (last < rest.length) parts.push({ text: rest.slice(last) })

  for (const part of parts) {
    if (part.href) {
      spans.push({ kind: "link", text: part.text, href: part.href })
      continue
    }
    // Bare URLs in a plain run become links too, since operators paste them.
    let cursor = 0
    for (const match of part.text.matchAll(BARE)) {
      const at = match.index ?? 0
      if (at > cursor) spans.push(...marks(part.text.slice(cursor, at)))
      const href = safeHref(match[0])
      spans.push(href ? { kind: "link", text: match[0], href } : { kind: "text", text: match[0] })
      cursor = at + match[0].length
    }
    if (cursor < part.text.length) spans.push(...marks(part.text.slice(cursor)))
  }
  return spans.length ? spans : [{ kind: "text", text: "" }]
}

/** `**bold**`, `*italic*` and `` `code` `` inside one run of plain text. */
function marks(text: string): Inline[] {
  const spans: Inline[] = []
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) spans.push({ kind: "text", text: text.slice(last, at) })
    if (match[1] !== undefined) spans.push({ kind: "code", text: match[1] })
    else if (match[2] !== undefined) spans.push({ kind: "strong", text: match[2] })
    else spans.push({ kind: "em", text: match[3] })
    last = at + match[0].length
  }
  if (last < text.length) spans.push({ kind: "text", text: text.slice(last) })
  return spans
}

export function markdown(source: string): Block[] {
  const blocks: Block[] = []
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    const fence = /^```(\w*)/.exec(trimmed)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i].trim())) body.push(lines[i++])
      i++ // the closing fence, or the end of the text
      blocks.push({ kind: "code", text: body.join("\n") })
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed)
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length as 1 | 2 | 3, spans: inline(heading[2]) })
      i++
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "rule" })
      i++
      continue
    }

    if (trimmed.startsWith(">")) {
      const body: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        body.push(lines[i].trim().replace(/^>\s?/, ""))
        i++
      }
      blocks.push({ kind: "quote", spans: inline(body.join(" ")) })
      continue
    }

    const bullet = /^([-*+]|\d+[.)])\s+(.*)$/.exec(trimmed)
    if (bullet) {
      const ordered = /\d/.test(bullet[1])
      const items: Inline[][] = []
      while (i < lines.length) {
        const item = /^([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i].trim())
        if (item && /\d/.test(item[1]) === ordered) {
          items.push(inline(item[2]))
          i++
        } else if (items.length && /^\s{2,}\S/.test(lines[i]) && lines[i].trim()) {
          // A wrapped continuation belongs to the item above it.
          items[items.length - 1] = [...items[items.length - 1], ...inline(` ${lines[i].trim()}`)]
          i++
        } else break
      }
      blocks.push({ kind: "list", ordered, items })
      continue
    }

    // A paragraph runs to the next blank line or the start of another block.
    const body: string[] = []
    while (i < lines.length) {
      const next = lines[i].trim()
      if (!next || /^(#{1,3}\s|```|>|[-*+]\s|\d+[.)]\s|-{3,}$|\*{3,}$|_{3,}$)/.test(next)) break
      body.push(next)
      i++
    }
    blocks.push({ kind: "paragraph", spans: inline(body.join(" ")) })
  }

  return blocks
}
