import { useEffect, useRef, useState } from "react"

import { entries, fields, saveConfig, type Values } from "@/lib/config"
import { IconClose } from "@/components/icons"

/**
 * The panel the hub shows the operator. It draws itself from theme.json's config
 * array, so the form and the manifest cannot drift apart. Every value here is
 * site-wide: it is written back to the hub, not to this browser.
 */

export function Settings({ values, onClose, onSaved }: { values: Values; onClose: () => void; onSaved: (next: Values) => void }) {
  const [draft, setDraft] = useState<Values>(values)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null)
  const closing = useRef<number | null>(null)
  useEffect(() => () => {
    if (closing.current !== null) clearTimeout(closing.current)
  }, [])

  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    addEventListener("keydown", escape)
    return () => removeEventListener("keydown", escape)
  }, [onClose])

  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }))

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await saveConfig(draft)
      onSaved(draft)
      // The write is visible in the page behind the drawer at once; the panel
      // stays just long enough to say so before it gets out of the way.
      setMessage({ kind: "ok", text: "已保存" })
      closing.current = window.setTimeout(onClose, 900)
    } catch (e) {
      // The hub answers a refused write with one line of Chinese text.
      setMessage({ kind: "bad", text: (e as Error).message || "保存失败" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="主题设置">
        <div className="drawer-head">
          <h2>主题设置</h2>
          <button className="icon-btn close" onClick={onClose} aria-label="关闭">
            <IconClose />
          </button>
        </div>

        <div className="drawer-body">
          {entries.map((entry, i) =>
            entry.type === "title" ? (
              <div className="field-group" key={`t-${i}`}>
                {entry.label}
              </div>
            ) : (
              <Field key={entry.key} field={entry} value={draft[entry.key]} onChange={(v) => set(entry.key, v)} />
            ),
          )}
          <p className="field-help" style={{ marginTop: 20 }}>
            这些设置保存在站点里，所有访客都会看到。共 {fields.length} 项。
          </p>
        </div>

        <div className="drawer-foot">
          <span className={`msg ${message?.kind ?? ""}`}>{message?.text ?? ""}</span>
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </aside>
    </>
  )
}

function Field({
  field,
  value,
  onChange,
}: {
  field: { key: string; type: string; label?: string; help?: string; options?: { value: string; label?: string }[]; min?: number; max?: number }
  value: unknown
  onChange: (v: unknown) => void
}) {
  const label = field.label ?? field.key

  if (field.type === "boolean") {
    return (
      <div className="field">
        <label className="switch">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span className="track" />
          <span>{label}</span>
        </label>
        {field.help ? <div className="field-help">{field.help}</div> : null}
      </div>
    )
  }

  if (field.type === "select") {
    return (
      <div className="field">
        <label className="field-label" htmlFor={`f-${field.key}`}>
          {label}
        </label>
        <select className="select" id={`f-${field.key}`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label ?? o.value}
            </option>
          ))}
        </select>
        {field.help ? <div className="field-help">{field.help}</div> : null}
      </div>
    )
  }

  if (field.type === "number") {
    return (
      <div className="field">
        <label className="field-label" htmlFor={`f-${field.key}`}>
          {label}
        </label>
        <input
          className="input"
          id={`f-${field.key}`}
          type="number"
          value={typeof value === "number" ? value : ""}
          min={field.min}
          max={field.max}
          onChange={(e) => {
            const next = e.target.value === "" ? field.min ?? 0 : Number(e.target.value)
            if (Number.isFinite(next)) onChange(next)
          }}
        />
        {field.help ? <div className="field-help">{field.help}</div> : null}
      </div>
    )
  }

  if (field.type === "text") {
    return (
      <div className="field">
        <label className="field-label" htmlFor={`f-${field.key}`}>
          {label}
        </label>
        <textarea
          className="textarea"
          id={`f-${field.key}`}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {field.help ? <div className="field-help">{field.help}</div> : null}
      </div>
    )
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={`f-${field.key}`}>
        {label}
      </label>
      <input
        className="input"
        id={`f-${field.key}`}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.help ? <div className="field-help">{field.help}</div> : null}
    </div>
  )
}
