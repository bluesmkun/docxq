import { markdown, type Block, type Inline } from "@/lib/markdown"

/**
 * Draws what `markdown()` parsed. Every element here is built by React from a
 * block or a span -- the operator's text never reaches the DOM as markup.
 */

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((span, i) => {
        switch (span.kind) {
          case "code":
            return <code key={i}>{span.text}</code>
          case "strong":
            return <strong key={i}>{span.text}</strong>
          case "em":
            return <em key={i}>{span.text}</em>
          case "link":
            return (
              <a key={i} href={span.href} target="_blank" rel="noopener noreferrer">
                {span.text}
              </a>
            )
          default:
            return <span key={i}>{span.text}</span>
        }
      })}
    </>
  )
}

function One({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading": {
      const Tag = (`h${block.level + 2}` as "h3" | "h4" | "h5")
      return (
        <Tag className="md-heading">
          <Spans spans={block.spans} />
        </Tag>
      )
    }
    case "paragraph":
      return (
        <p>
          <Spans spans={block.spans} />
        </p>
      )
    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag>
          {block.items.map((item, i) => (
            <li key={i}>
              <Spans spans={item} />
            </li>
          ))}
        </Tag>
      )
    }
    case "quote":
      return (
        <blockquote>
          <Spans spans={block.spans} />
        </blockquote>
      )
    case "code":
      return (
        <pre className="md-code">
          <code>{block.text}</code>
        </pre>
      )
    case "rule":
      return <hr />
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = markdown(source)
  if (!blocks.length) return null
  return (
    <div className="prose md">
      {blocks.map((block, i) => (
        <One key={i} block={block} />
      ))}
    </div>
  )
}
