import { useCallback, useEffect, useState } from "react"

import { api, type Me } from "@/lib/api"
import { loadConfig, type Values } from "@/lib/config"

/** `/node/{id}` is a real page: it survives a reload, can be linked to, and back returns to the list. */
function readRoute(): number | null {
  const match = location.pathname.match(/^\/node\/(\d+)/)
  return match ? Number(match[1]) : null
}

export function useRoute() {
  const [id, setId] = useState(readRoute)
  useEffect(() => {
    const sync = () => setId(readRoute())
    addEventListener("popstate", sync)
    return () => removeEventListener("popstate", sync)
  }, [])
  const go = useCallback((next: number | null) => {
    const path = next === null ? "/" : `/node/${next}`
    if (location.pathname !== path) history.pushState({}, "", path)
    setId(next)
    scrollTo(0, 0)
  }, [])
  return [id, go] as const
}

const DARK_MEDIA = matchMedia("(prefers-color-scheme: dark)")

/**
 * The visitor's own choice, or the theme setting, or the system's. Only the
 * toggle writes the choice down: pinning the system's answer on load would leave
 * a visitor who never touched it in whichever mode their OS was in that day.
 */
export function useTheme(preference: "auto" | "light" | "dark") {
  // Storage can be switched off for the site, and then even reading it throws.
  const [saved, setSaved] = useState<"light" | "dark" | null>(() => {
    try {
      return localStorage.getItem("doc-theme") as "light" | "dark" | null
    } catch {
      return null
    }
  })
  const [system, setSystem] = useState(DARK_MEDIA.matches)
  useEffect(() => {
    const sync = () => setSystem(DARK_MEDIA.matches)
    DARK_MEDIA.addEventListener("change", sync)
    return () => DARK_MEDIA.removeEventListener("change", sync)
  }, [])
  const dark = saved ? saved === "dark" : preference === "auto" ? system : preference === "dark"

  // Every transition held while the palette changes: a meter already in the dark
  // palette would otherwise fade against a card still light.
  useEffect(() => {
    const hold = document.createElement("style")
    hold.textContent = "*,*::before,*::after{transition:none!important}"
    document.head.append(hold)
    document.documentElement.dataset.theme = dark ? "dark" : "light"
    void document.body.offsetWidth
    hold.remove()
  }, [dark])

  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark"
    try {
      localStorage.setItem("doc-theme", next)
    } catch {
      // The choice then lasts until the page is closed.
    }
    setSaved(next)
  }, [dark])

  return { dark, toggle }
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState("")
  const load = useCallback(
    () =>
      api<Me>("/me")
        .then((next) => {
          setMe(next)
          setError("")
        })
        .catch((e: Error) => setError(e.message)),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])
  return { me, error, reload: load }
}

/** Site settings, fetched alongside `/me` and `/nodes`; failures fall back to the defaults. */
export function useConfig() {
  const [config, setConfig] = useState<Values | null>(null)
  useEffect(() => {
    let live = true
    void loadConfig().then((next) => {
      if (live) setConfig(next)
    })
    return () => {
      live = false
    }
  }, [])
  return config
}
