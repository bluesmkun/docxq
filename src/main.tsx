import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "@/App"
import "@/styles.css"

// The hub serves this directory for any path it does not own, so /node/12 is
// drawn here rather than by a server render.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
